const chatService = require('../services/chatService');

const chatController = {
    getSessions: async (req, res) => {
        try {
            const sessions = await chatService.getSessions(req.user.id);
            return res.status(200).json(sessions);
        } catch (error) {
            console.error('Lỗi tại chatController.getSessions:', error);
            return res.status(500).json({ message: req.t('server.internalError') });
        }
    },

    getSessionMessages: async (req, res) => {
        try {
            const messages = await chatService.getSessionMessages(req.params.id);
            return res.status(200).json(messages);
        } catch (error) {
            console.error('Lỗi tại chatController.getSessionMessages:', error);
            return res.status(500).json({ message: req.t('server.internalError') });
        }
    },

    deleteAllSessions: async (req, res) => {
        try {
            const result = await chatService.deleteAllSessions(req.user.id);
            return res.status(200).json({ message: req.t(result.message) });
        } catch (error) {
            console.error('Lỗi tại chatController.deleteAllSessions:', error);
            return res.status(500).json({ message: req.t('server.internalError') });
        }
    },

    deleteSession: async (req, res) => {
        try {
            const result = await chatService.deleteSession(req.params.id, req.user.id);
            if (result.error) return res.status(result.status).json({ message: req.t(result.error) });
            return res.status(200).json({ message: req.t(result.message) });
        } catch (error) {
            console.error('Lỗi tại chatController.deleteSession:', error);
            return res.status(500).json({ message: req.t('server.internalError') });
        }
    },

    renameSession: async (req, res) => {
        try {
            const result = await chatService.renameSession(req.params.id, req.user.id, req.body.title);
            if (result.error) return res.status(result.status).json({ message: req.t(result.error) });
            return res.status(200).json({ message: req.t(result.message), title: result.title });
        } catch (error) {
            console.error('Lỗi tại chatController.renameSession:', error);
            return res.status(500).json({ message: req.t('server.internalError') });
        }
    },

    shareSession: async (req, res) => {
        try {
            const result = await chatService.shareSession(req.params.id, req.user.id);
            if (result.error) return res.status(result.status).json({ message: req.t(result.error) });
            return res.status(200).json({ message: req.t(result.message), is_shared: result.is_shared });
        } catch (error) {
            console.error('Lỗi tại chatController.shareSession:', error);
            return res.status(500).json({ message: req.t('server.internalError') });
        }
    },

    getPublicSession: async (req, res) => {
        try {
            const result = await chatService.getPublicSession(req.params.id);
            if (result.error) return res.status(result.status).json({ message: req.t(result.error) });
            return res.status(200).json(result.data);
        } catch (error) {
            console.error('Lỗi tại chatController.getPublicSession:', error);
            return res.status(500).json({ message: req.t('server.internalError') });
        }
    }
};

module.exports = chatController;