const ChatSession = require('../models/chatSession');
const ChatMessage = require('../models/chatMessage');
const aiService = require('./aiService');

const chatService = {
    prepareChatSessionAndMessage: async (userId, sessionId, cleanMessage, messageToSave, parsedEditIndex, customGroqKey) => {
        let currentSessionId = sessionId;
        let isNewSession = false;
        let userMessageRecord = null;

        if (!currentSessionId) {
            let title = cleanMessage.substring(0, 30) + (cleanMessage.length > 30 ? "..." : ""); 
            try {
                const aiTitle = await aiService.generateTitle(cleanMessage, customGroqKey);
                if (aiTitle) title = aiTitle;
            } catch (error) {}

            const newSession = await ChatSession.create({ user_id: userId, title: title });
            currentSessionId = newSession.id;
            isNewSession = true;
        } else {
            if (parsedEditIndex === undefined) {
                const messageCount = await ChatMessage.count({ where: { session_id: currentSessionId } });
                if (messageCount >= 100) {
                    const limitError = new Error('Phiên trò chuyện này đã đạt giới hạn tối đa 100 tin nhắn. Vui lòng tạo phiên trò chuyện mới.');
                    limitError.status = 400;
                    throw limitError;
                }
            }
            await ChatSession.update({ updated_at: new Date() }, { where: { id: currentSessionId } });
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

        return { currentSessionId, isNewSession, userMessageRecord };
    },

    saveAIMessage: async (sessionId, aiResponse) => {
        return await ChatMessage.create({ session_id: sessionId, role: 'ai', content: aiResponse });
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
    },

    getSessions: async (userId) => {
        return await ChatSession.findAll({
            where: { user_id: userId, is_archived: false },
            order: [['updated_at', 'DESC']]
        });
    },

    getSessionMessages: async (sessionId) => {
        return await ChatMessage.findAll({
            where: { session_id: sessionId },
            order: [['created_at', 'ASC']]
        });
    },

    deleteAllSessions: async (userId) => {
        const sessions = await ChatSession.findAll({ where: { user_id: userId } });
        const sessionIds = sessions.map(s => s.id);
        if (sessionIds.length > 0) {
            await ChatMessage.destroy({ where: { session_id: sessionIds } });
            await ChatSession.destroy({ where: { user_id: userId } });
        }
        return { message: 'Đã xóa toàn bộ lịch sử trò chuyện.' };
    },

    deleteSession: async (sessionId, userId) => {
        const session = await ChatSession.findOne({ where: { id: sessionId, user_id: userId } });
        if (!session) return { error: 'Không tìm thấy phiên trò chuyện.', status: 404 };
        await ChatMessage.destroy({ where: { session_id: sessionId } });
        await ChatSession.destroy({ where: { id: sessionId } });
        return { message: 'Đã xóa phiên trò chuyện.' };
    },

    renameSession: async (sessionId, userId, title) => {
        if (!title || !title.trim()) return { error: 'Tiêu đề không được để trống.', status: 400 };
        const session = await ChatSession.findOne({ where: { id: sessionId, user_id: userId } });
        if (!session) return { error: 'Không tìm thấy phiên trò chuyện.', status: 404 };
        await ChatSession.update({ title: title.trim() }, { where: { id: sessionId }, silent: true });
        return { message: 'Đã đổi tên phiên trò chuyện.', title: title.trim() };
    },

    shareSession: async (sessionId, userId) => {
        const session = await ChatSession.findOne({ where: { id: sessionId, user_id: userId } });
        if (!session) return { error: 'Không tìm thấy phiên trò chuyện.', status: 404 };
        await ChatSession.update({ is_shared: true }, { where: { id: sessionId } });
        return { message: 'Đã chia sẻ phiên trò chuyện công khai.', is_shared: true };
    },

    getPublicSession: async (sessionId) => {
        const session = await ChatSession.findByPk(sessionId);
        if (!session || !session.is_shared) {
            return { error: 'Phiên trò chuyện không tồn tại hoặc chưa được chia sẻ công khai.', status: 404 };
        }
        const messages = await ChatMessage.findAll({
            where: { session_id: sessionId },
            order: [['created_at', 'ASC']]
        });
        return { data: { title: session.title, messages }, status: 200 };
    }
};

module.exports = chatService;