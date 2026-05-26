const aiService = require('../services/aiService');
const ChatSession = require('../models/chatSession');
const ChatMessage = require('../models/chatMessage');
const axios = require('axios');

const aiController = {
    chat: async (req, res) => {
        try {
            const { message, sessionId, model } = req.body;
            const userId = req.user.id;

            if (!message) {
                return res.status(400).json({ message: 'Vui lòng cung cấp nội dung câu hỏi (message).' });
            }

            // 1. Quản lý Session: Nếu là lần chat đầu tiên (không có sessionId) thì tạo phiên mới
            let currentSessionId = sessionId;
            if (!currentSessionId) {
                const title = message.substring(0, 30) + (message.length > 30 ? "..." : ""); 
                const newSession = await ChatSession.create({ user_id: userId, title: title });
                currentSessionId = newSession.id;
            } else {
                // Cập nhật lại thời gian của cuộc trò chuyện để nó nổi lên đầu danh sách
                await ChatSession.update({ updated_at: new Date() }, { where: { id: currentSessionId } });
            }

            // 2. Lưu tin nhắn của User vào Database
            await ChatMessage.create({ session_id: currentSessionId, role: 'user', content: message });

            let aiResponse = "";

            // TÍCH HỢP FLOWISE: Kiểm tra model mà user đã chọn
            if (model === "Data Analyst") {
                // Dùng Axios bắn API sang Flowise
                const flowiseUrl = process.env.FLOWISE_API_URL || 'https://cloud.flowiseai.com/api/v1/prediction/67f836bc-a994-45ce-98f7-2c64aef4f72d';
                
                try {
                    const flowiseRes = await axios.post(flowiseUrl, {
                        question: message,
                        overrideConfig: {
                            sessionId: currentSessionId // Truyền sessionId để Flowise nhớ ngữ cảnh chat cũ
                        }
                    });
                    aiResponse = flowiseRes.data.text || flowiseRes.data;
                
                    // Kiểm tra nếu response trả về là HTML (do cấu hình sai link API)
                    if (typeof aiResponse === 'string' && (aiResponse.trim().startsWith('<!DOCTYPE') || aiResponse.trim().startsWith('<html') || aiResponse.includes('<link rel="preconnect"'))) {
                        aiResponse = "⚠️ **Lỗi cấu hình:** Kết nối tới Flowise bị sai đường dẫn API. Hệ thống đang trả về giao diện HTML thay vì dữ liệu. Vui lòng kiểm tra lại `FLOWISE_API_URL`.";
                    }
                } catch (error) {
                    console.error('Lỗi khi gọi API Flowise:', error.response?.data || error.message);
                    aiResponse = `⚠️ **Lỗi từ Flowise:** Máy chủ phân tích dữ liệu đang gặp sự cố (Lỗi 500). \n\n**Chi tiết lỗi:** \`${error.response?.data?.message || JSON.stringify(error.response?.data) || error.message}\``;
                }
            } else {
                // Mặc định gọi Llama 3 qua Groq
                aiResponse = await aiService.chatWithAI(message);
            }

            // 3. Lưu tin nhắn của AI vào Database
            await ChatMessage.create({ session_id: currentSessionId, role: 'ai', content: aiResponse });

            return res.status(200).json({
                message: aiResponse,
                sessionId: currentSessionId // Trả mã session về cho React
            });
        } catch (error) {
            console.error('Lỗi tại aiController.chat:', error);
            return res.status(500).json({ message: 'Lỗi server khi xử lý yêu cầu AI.' });
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
    }
};

module.exports = aiController;
