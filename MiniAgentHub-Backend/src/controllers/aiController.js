const aiService = require('../services/aiService');
const ChatSession = require('../models/chatSession');
const ChatMessage = require('../models/chatMessage');
const fs = require('fs');

// Hàm gỡ bỏ hình ảnh Base64 khổng lồ ra khỏi văn bản trước khi đưa cho AI đọc
const cleanBase64Images = (text) => {
    if (!text) return text;
    return text.replace(/!\[(.*?)\]\(data:image\/[^;]+;base64,[^\)]+\)/g, '[🖼️ Hình ảnh đính kèm: $1]');
};

const aiController = {
    chat: async (req, res) => {
        let currentSessionId = null;
        let isNewSession = false;
        let userMessageRecord = null;

        try {
            const { message, sessionId, model, isPing } = req.body;
            const file = req.file;

            if (isPing) {
                const groqReady = !!(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '');
                const flowiseReady = !!(process.env.FLOWISE_API_URL && process.env.FLOWISE_API_URL.trim() !== '');
                return res.status(200).json({ ready: groqReady, flowiseReady: flowiseReady });
            }

            const userId = req.user.id;

            if (!message) {
                if (!file) {
                    return res.status(400).json({ message: 'Vui lòng cung cấp nội dung câu hỏi hoặc file đính kèm.' });
                }
            }

            let cleanMessage = cleanBase64Images(message) || '';
            let processedMessage = cleanMessage;
            let flowiseUploads = [];
            let messageToSave = message; // Chuỗi sẽ được lưu vào DB

            if (file) {
                try {
                    let base64Data = null;
                    if (file.mimetype.startsWith('image/')) {
                        const fileData = fs.readFileSync(file.path);
                        base64Data = fileData.toString('base64');
                        // Phục hồi lại định dạng base64 từ file vật lý để lưu DB (cho frontend hiển thị)
                        messageToSave = message.replace(
                            /\[🖼️ Hình ảnh đính kèm: (.*?)\]/g, 
                            `!$1`
                        );
                    }

                    if (model === "Data Analyst") {
                        if (!base64Data) {
                            const fileData = fs.readFileSync(file.path);
                            base64Data = fileData.toString('base64');
                        }
                        flowiseUploads.push({
                            data: `data:${file.mimetype};base64,${base64Data}`,
                            type: 'file',
                            name: file.originalname,
                            mime: file.mimetype
                        });
                        fs.unlinkSync(file.path); // Dọn dẹp file tạm
                    } else {
                        const fileContent = await aiService.extractFileContent(file);
                        processedMessage = `Người dùng đã đính kèm một file có nội dung như sau:\n\n"""\n${fileContent}\n"""\n\nDựa vào file trên, hãy trả lời: ${cleanMessage}`;
                    }
                } catch (err) {
                    console.error("Lỗi xử lý file đính kèm:", err);
                    if (file && file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
                    if (err.message === 'UNSUPPORTED_FILE_TYPE') {
                        return res.status(400).json({ message: 'Chỉ hỗ trợ file dạng Text, CSV, JSON hoặc PDF.' });
                    }
                    return res.status(500).json({ message: 'Lỗi đọc file. Có thể thư viện pdf-parse bị lỗi hoặc file bị hỏng.' });
                }
            }

            currentSessionId = sessionId;
            
            if (!currentSessionId) {
                let title = cleanMessage.substring(0, 30) + (cleanMessage.length > 30 ? "..." : ""); 
                
                try {
                    const aiTitle = await aiService.generateTitle(cleanMessage);
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

            const parsedEditIndex = req.body.editIndex !== undefined ? parseInt(req.body.editIndex, 10) : undefined;

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

            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            
            res.write(`data: ${JSON.stringify({ sessionId: currentSessionId })}\n\n`);

            let aiResponse = "";
            let flowiseFailed = false;

            if (model === "Data Analyst") {
                const flowiseResult = await aiService.chatWithFlowise(processedMessage, currentSessionId, flowiseUploads);
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
                
                // 1. Lấy lịch sử trò chuyện của phiên hiện tại từ DB
                const pastMessages = await ChatMessage.findAll({
                    where: { session_id: currentSessionId },
                    order: [['created_at', 'ASC']]
                });

                // 2. Chuyển đổi định dạng và cấu hình System Prompt
                const messagesForAI = [
                    { role: 'system', content: 'Bạn là một trợ lý AI thông minh, nhiệt tình của Neural Hub. Luôn trả lời bằng Tiếng Việt, định dạng văn bản rõ ràng bằng Markdown.' },
                    ...pastMessages.slice(-20).map(m => ({ // Lấy 20 tin nhắn gần nhất để tránh tràn token
                        role: m.role === 'ai' ? 'assistant' : 'user',
                        content: cleanBase64Images(m.content)
                    }))
                ];

                // 3. Ghi đè nội dung tin nhắn user cuối cùng (vừa lưu) để gộp cả phần text của file đính kèm (nếu có)
                if (messagesForAI.length > 0 && messagesForAI[messagesForAI.length - 1].role === 'user') {
                    messagesForAI[messagesForAI.length - 1].content = processedMessage;
                }

                const stream = await aiService.chatWithAIStream(messagesForAI);
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
                if (userMessageRecord && parsedEditIndex === undefined) await ChatMessage.destroy({ where: { id: userMessageRecord.id } });
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
