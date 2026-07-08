const ChatSession = require('../models/chatSession');
const ChatMessage = require('../models/chatMessage');
const AppError = require('../utils/AppError');
const { sequelize } = require('../config/database');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const redisClient = require('../config/redis');

const chatService = {
    prepareChatSessionAndMessage: async (userId, sessionId, cleanMessage, messageToSave, parsedEditIndex, customGroqKey) => {
        let currentSessionId = sessionId;
        let isNewSession = false;
        let userMessageRecord = null;

        if (!currentSessionId) {
            let title = cleanMessage.substring(0, 30) + (cleanMessage.length > 30 ? "..." : "");
            try {
                const aiService = require('./aiService'); 
                const aiTitle = await aiService.generateTitle(cleanMessage, customGroqKey);
                if (aiTitle) title = aiTitle;
            } catch (error) { }

            const newSession = await ChatSession.create({ user_id: userId, title: title });
            currentSessionId = newSession.id;
            isNewSession = true;
        } else {
            const session = await ChatSession.findOne({ where: { id: currentSessionId, user_id: userId } });
            if (!session) throw new AppError('chat.notFound', 'NOT_FOUND');

            if (parsedEditIndex === undefined) {
                const messageCount = await ChatMessage.count({ where: { session_id: currentSessionId } });
                if (messageCount >= 100) {
                    throw new AppError('chat.limitExceeded', 'BAD_REQUEST');
                }
            }
            await ChatSession.update(
                { updated_at: sequelize.literal('CURRENT_TIMESTAMP') },
                { where: { id: currentSessionId } }
            );
        }

        if (parsedEditIndex !== undefined && !isNaN(parsedEditIndex) && currentSessionId && !isNewSession) {
            const pastMsgs = await ChatMessage.findAll({
                where: { session_id: currentSessionId },
                order: [['created_at', 'ASC']]
            });

            if (pastMsgs[parsedEditIndex] && pastMsgs[parsedEditIndex].role === 'user') {
                const msgToEdit = pastMsgs[parsedEditIndex];
                await ChatMessage.update({ content: messageToSave }, { where: { id: msgToEdit.id } });
                userMessageRecord = await ChatMessage.findByPk(msgToEdit.id);

                const messagesToDelete = pastMsgs.slice(parsedEditIndex + 1).map(m => m.id);
                if (messagesToDelete.length > 0) {
                    await ChatMessage.destroy({ where: { id: messagesToDelete } });
                }
            } else {
                userMessageRecord = await ChatMessage.create({ session_id: currentSessionId, role: 'user', content: messageToSave });
            }
        } else {
            userMessageRecord = await ChatMessage.create({ session_id: currentSessionId, role: 'user', content: messageToSave });
        }

        await redisClient.del(`chat:messages:${currentSessionId}`);

        return { currentSessionId, isNewSession, userMessageRecord };
    },

    saveAIMessage: async (sessionId, aiResponse) => {
        const msg = await ChatMessage.create({ session_id: sessionId, role: 'ai', content: aiResponse });
        await redisClient.del(`chat:messages:${sessionId}`);
        return msg;
    },

    truncateLastAIMessage: async (sessionId, userId, content) => {
        const session = await ChatSession.findOne({ where: { id: sessionId, user_id: userId } });
        if (!session) throw new AppError('chat.notFound', 'NOT_FOUND');

        const lastMessage = await ChatMessage.findOne({
            where: { session_id: sessionId, role: 'ai' },
            order: [['created_at', 'DESC']]
        });

        if (lastMessage) {
            lastMessage.content = content;
            await lastMessage.save();
            await redisClient.del(`chat:messages:${sessionId}`);
            return { message: 'chat.truncateSuccess' };
        }
        return { message: 'chat.noAIMessageFound' };
    },

    cleanupOnError: async (userMessageRecord, isNewSession, currentSessionId, parsedEditIndex) => {
        try {
            if (userMessageRecord && parsedEditIndex === undefined) {
                await ChatMessage.destroy({ where: { id: userMessageRecord.id } });
            }
            if (isNewSession && currentSessionId) {
                await ChatSession.destroy({ where: { id: currentSessionId } });
            }
        } catch (cleanupError) {
            console.error('Lỗi khi dọn dẹp DB:', cleanupError);
        }
        
        if (currentSessionId) {
            await redisClient.del(`chat:messages:${currentSessionId}`);
        }
    },

    getSessions: async (userId, page = 1, limit = 20) => {
        const offset = (page - 1) * limit;
        return await ChatSession.findAndCountAll({
            where: { user_id: userId, is_archived: false },
            order: [['updated_at', 'DESC']],
            limit,
            offset
        });
    },

    getSessionMessages: async (sessionId, userId) => {
        const cacheKey = `chat:messages:${sessionId}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) {
            const session = await ChatSession.findOne({ where: { id: sessionId, user_id: userId }, attributes: ['id'] });
            if (!session) throw new AppError('chat.notFound', 'NOT_FOUND');
            return JSON.parse(cached);
        }

        const session = await ChatSession.findOne({ where: { id: sessionId, user_id: userId } });
        if (!session) throw new AppError('chat.notFound', 'NOT_FOUND');

        const messages = await ChatMessage.findAll({
            where: { session_id: sessionId },
            order: [['created_at', 'ASC']]
        });

        await redisClient.setex(cacheKey, 86400, JSON.stringify(messages));
        return messages;
    },

    getAllUserSessionIds: async (userId) => {
        const sessions = await ChatSession.findAll({ where: { user_id: userId }, attributes: ['id'] });
        return sessions.map(s => s.id);
    },

    getGlobalContextMessages: async (sessionIds, limit = 10) => {
        return await ChatMessage.findAll({
            where: { session_id: sessionIds },
            order: [['created_at', 'DESC']],
            limit
        });
    },

    deleteAllSessions: async (userId) => {
        const sessions = await ChatSession.findAll({
            where: { user_id: userId },
            attributes: ['id']
        });
        const sessionIds = sessions.map(s => s.id);
        if (sessionIds.length > 0) {
            const messages = await ChatMessage.findAll({ where: { session_id: sessionIds}});
            await chatService.deleteImagesFromMessages(messages);
            const transaction = await sequelize.transaction();
            try {
                await ChatMessage.destroy({ where: { session_id: sessionIds }, transaction });
                await ChatSession.destroy({ where: { user_id: userId }, transaction });
                await transaction.commit();
                
                if (sessionIds.length > 0) {
                    const pipeline = redisClient.pipeline();
                    sessionIds.forEach(id => pipeline.del(`chat:messages:${id}`));
                    await pipeline.exec();
                }
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
        }
        return { message: 'chat.deleteAllSuccess' };
    },

    deleteSession: async (sessionId, userId) => {
        const session = await ChatSession.findOne({ where: { id: sessionId, user_id: userId } });
        if (!session) throw new AppError('chat.notFound', 'NOT_FOUND');
        const messages = await ChatMessage.findAll({ where: {session_id: sessionId}});
        await chatService.deleteImagesFromMessages(messages); 
        const transaction = await sequelize.transaction();
        try {
            await ChatMessage.destroy({ where: { session_id: sessionId }, transaction });
            await ChatSession.destroy({ where: { id: sessionId }, transaction });
            await transaction.commit();
            await redisClient.del(`chat:messages:${sessionId}`);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
        return { message: 'chat.deleteSuccess' };
    },

    renameSession: async (sessionId, userId, title) => {
        if (!title || !title.trim()) throw new AppError('chat.titleRequired', 'BAD_REQUEST');
        const session = await ChatSession.findOne({ where: { id: sessionId, user_id: userId } });
        if (!session) throw new AppError('chat.notFound', 'NOT_FOUND');
        await ChatSession.update({ title: title.trim() }, { where: { id: sessionId }, silent: true });
        return { message: 'chat.renameSuccess', title: title.trim() };
    },

    shareSession: async (sessionId, userId) => {
        const session = await ChatSession.findOne({ where: { id: sessionId, user_id: userId } });
        if (!session) throw new AppError('chat.notFound', 'NOT_FOUND');
        await ChatSession.update({ is_shared: true }, { where: { id: sessionId } });
        return { message: 'chat.shareSuccess', is_shared: true };
    },

    getPublicSession: async (sessionId) => {
        const session = await ChatSession.findByPk(sessionId);
        if (!session || !session.is_shared) {
            throw new AppError('chat.publicSessionNotFound', 'NOT_FOUND');
        }
        const messages = await ChatMessage.findAll({
            where: { session_id: sessionId },
            order: [['created_at', 'ASC']]
        });
        return { title: session.title, messages };
    },

    deleteImagesFromMessages: async(messages) => {
        try {
            const regex = /\/api\/uploads\/([a-zA-Z0-9_.-]+)/g;
            for (const msg of messages) {
                if (msg.content) {
                    let match;
                    while ((match = regex.exec(msg.content)) !== null){
                        const filename = match[1];
                        const filepath = path.join(__dirname, '..','..','uploads', filename);
                        if (fs.existsSync(filepath)) {
                            await fsp.unlink(filepath).catch(() => {});
                        }
                    }
                }
            } 
        } catch (err) {
            console.error("Error deleting images:", err);
        }       
    }
};

module.exports = chatService;