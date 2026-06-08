const aiService = require('../services/aiService');
const ChatSession = require('../models/chatSession');
const ChatMessage = require('../models/chatMessage');

const aiController = {
    chat: async (req, res) => {
        try {
            const { message, sessionId, model, isPing } = req.body;

            if (isPing) {
                const groqReady = !!(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '');
                const flowiseReady = !!(process.env.FLOWISE_API_URL && process.env.FLOWISE_API_URL.trim() !== '');
                return res.status(200).json({ ready: groqReady, flowiseReady: flowiseReady });
            }

            const userId = req.user.id;

            if (!message) {
                return res.status(400).json({ message: 'Vui lòng cung cấp nội dung câu hỏi (message).' });
            }

            let currentSessionId = sessionId;
            let isNewSession = false;
            let userMessageRecord = null;
            
            if (!currentSessionId) {
                let title = message.substring(0, 30) + (message.length > 30 ? "..." : ""); 
                
                try {
                    const aiTitle = await aiService.generateTitle(message);
                    if (aiTitle) {
                        title = aiTitle;
                    }
                } catch (error) {
                }

                const newSession = await ChatSession.create({ user_id: userId, title: title });
                currentSessionId = newSession.id;
                isNewSession = true;
            } else {
                await ChatSession.update({ updated_at: new Date() }, { where: { id: currentSessionId } });
            }

            userMessageRecord = await ChatMessage.create({ session_id: currentSessionId, role: 'user', content: message });

            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            
            res.write(`data: ${JSON.stringify({ sessionId: currentSessionId })}\n\n`);

            let aiResponse = "";
            let flowiseFailed = false;

            if (model === "Data Analyst") {
                const flowiseResult = await aiService.chatWithFlowise(message, currentSessionId);
                aiResponse = flowiseResult.response;
                flowiseFailed = flowiseResult.failed;

                if (!flowiseFailed) {
                    res.write(`data: ${JSON.stringify({ chunk: aiResponse })}\n\n`);
                }
            }
            
            if (model !== "Data Analyst" || flowiseFailed) {
                if (flowiseFailed) {
                    res.write(`data: ${JSON.stringify({ flowiseUnavailable: true })}\n\n`);
                }
                const stream = await aiService.chatWithAIStream(message);
                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || "";
                    if (content) {
                        aiResponse += content;
                        res.write(`data: ${JSON.stringify({ chunk: content })}\n\n`);
                    }
                }
            }

            await ChatMessage.create({ session_id: currentSessionId, role: 'ai', content: aiResponse });

            res.write(`data: [DONE]\n\n`);
            res.end();
        } catch (error) {
            console.error('Lỗi tại aiController.chat:', error);

            try {
                if (userMessageRecord) await ChatMessage.destroy({ where: { id: userMessageRecord.id } });
                if (isNewSession && currentSessionId) {
                    await ChatSession.destroy({ where: { id: currentSessionId } });
                }
            } catch (cleanupError) {
                console.error('Lỗi khi dọn dẹp DB:', cleanupError);
            }

            let errorMessage = '\n\nĐã xảy ra lỗi trong quá trình xử lý.';
            if (error.status === 401 || (error.message && error.message.includes('Invalid API Key'))) {
                errorMessage = '\n\nLỗi hệ thống: API Key của hệ thống AI (Groq) không hợp lệ hoặc chưa được cấu hình. Vui lòng kiểm tra lại file .env của backend.';
            }

            if (!res.headersSent) {
                return res.status(500).json({ message: 'Lỗi server khi xử lý yêu cầu AI.' });
            } else {
                res.write(`data: ${JSON.stringify({ chunk: errorMessage })}\n\n`);
                res.write(`data: [DONE]\n\n`);
                res.end();
            }
        }
    },
    
    getSessions: async (req, res) => {
        try {
            const sessions = await ChatSession.findAll({
                where: { user_id: req.user.id, is_archived: false },
                order: [['updated_at', 'DESC']]
            });
            return res.status(200).json(sessions);
        } catch (error) {
            return res.status(500).json({ message: 'Lỗi server lấy danh sách chat.' });
        }
    },

    getSessionMessages: async (req, res) => {
        try {
            const messages = await ChatMessage.findAll({
                where: { session_id: req.params.id },
                order: [['created_at', 'ASC']]
            });
            return res.status(200).json(messages);
        } catch (error) {
            return res.status(500).json({ message: 'Lỗi server lấy tin nhắn.' });
        }
    },

    deleteAllSessions: async (req, res) => {
        try {
            const userId = req.user.id;
            const sessions = await ChatSession.findAll({ where: { user_id: userId } });
            const sessionIds = sessions.map(s => s.id);
            
            if (sessionIds.length > 0) {
                await ChatMessage.destroy({ where: { session_id: sessionIds } });
                await ChatSession.destroy({ where: { user_id: userId } });
            }
            
            return res.status(200).json({ message: 'Đã xóa toàn bộ lịch sử trò chuyện.' });
        } catch (error) {
            console.error('Lỗi tại aiController.deleteAllSessions:', error);
            return res.status(500).json({ message: 'Lỗi server khi xóa lịch sử chat.' });
        }
    },

    deleteSession: async (req, res) => {
        try {
            const sessionId = req.params.id;
            const userId = req.user.id;
            
            const session = await ChatSession.findOne({ where: { id: sessionId, user_id: userId } });
            if (!session) {
                return res.status(404).json({ message: 'Không tìm thấy phiên trò chuyện.' });
            }

            await ChatMessage.destroy({ where: { session_id: sessionId } });
            await ChatSession.destroy({ where: { id: sessionId } });
            
            return res.status(200).json({ message: 'Đã xóa phiên trò chuyện.' });
        } catch (error) {
            console.error('Lỗi tại aiController.deleteSession:', error);
            return res.status(500).json({ message: 'Lỗi server khi xóa phiên trò chuyện.' });
        }
    },

    renameSession: async (req, res) => {
        try {
            const sessionId = req.params.id;
            const userId = req.user.id;
            const { title } = req.body;

            if (!title || !title.trim()) {
                return res.status(400).json({ message: 'Tiêu đề không được để trống.' });
            }

            const session = await ChatSession.findOne({ where: { id: sessionId, user_id: userId } });
            if (!session) {
                return res.status(404).json({ message: 'Không tìm thấy phiên trò chuyện.' });
            }

            await ChatSession.update({ title: title.trim() }, { where: { id: sessionId }, silent: true });
            
            return res.status(200).json({ message: 'Đã đổi tên phiên trò chuyện.', title: title.trim() });
        } catch (error) {
            console.error('Lỗi tại aiController.renameSession:', error);
            return res.status(500).json({ message: 'Lỗi server khi đổi tên phiên trò chuyện.' });
        }
    }
};

module.exports = aiController;
