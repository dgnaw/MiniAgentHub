const chatService = require('../services/chatService');

const chatController = {
    getSessions: async (req, res) => {
        try {
            const sessions = await chatService.getSessions(req.user.id);
            return res.status(200).json(sessions);
        } catch (error) {
            console.error('Lỗi tại chatController.getSessions:', error);
            return res.status(500).json({ message: 'Lỗi server lấy danh sách chat.' });
        }
    },

    getSessionMessages: async (req, res) => {
        try {
            const messages = await chatService.getSessionMessages(req.params.id);
            return res.status(200).json(messages);
        } catch (error) {
            console.error('Lỗi tại chatController.getSessionMessages:', error);
            return res.status(500).json({ message: 'Lỗi server lấy tin nhắn.' });
        }
    },

    deleteAllSessions: async (req, res) => {
        try {
            const result = await chatService.deleteAllSessions(req.user.id);
            return res.status(200).json(result);
        } catch (error) {
            console.error('Lỗi tại chatController.deleteAllSessions:', error);
            return res.status(500).json({ message: 'Lỗi server khi xóa lịch sử chat.' });
        }
    },

    deleteSession: async (req, res) => {
        try {
            const result = await chatService.deleteSession(req.params.id, req.user.id);
            if (result.error) return res.status(result.status).json({ message: result.error });
            return res.status(200).json(result);
        } catch (error) {
            console.error('Lỗi tại chatController.deleteSession:', error);
            return res.status(500).json({ message: 'Lỗi server khi xóa phiên trò chuyện.' });
        }
    },

    renameSession: async (req, res) => {
        try {
            const result = await chatService.renameSession(req.params.id, req.user.id, req.body.title);
            if (result.error) return res.status(result.status).json({ message: result.error });
            return res.status(200).json(result);
        } catch (error) {
            console.error('Lỗi tại chatController.renameSession:', error);
            return res.status(500).json({ message: 'Lỗi server khi đổi tên phiên trò chuyện.' });
        }
    }
};

module.exports = chatController;