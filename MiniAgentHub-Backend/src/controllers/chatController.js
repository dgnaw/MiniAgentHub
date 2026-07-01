const chatService = require('../services/chatService');

const chatController = {
    getSessions: async (req, res, next) => {
        try {
            const sessions = await chatService.getSessions(req.user.id);
            return res.status(200).json(sessions);
        } catch (error) {
            next(error);
        }
    },

    getSessionMessages: async (req, res, next) => {
        try {
            const messages = await chatService.getSessionMessages(req.params.id);
            return res.status(200).json(messages);
        } catch (error) {
            next(error);
        }
    },

    deleteAllSessions: async (req, res, next) => {
        try {
            const result = await chatService.deleteAllSessions(req.user.id);
            return res.status(200).json({ message: req.t(result.message) });
        } catch (error) {
            next(error);
        }
    },

    deleteSession: async (req, res, next) => {
        try {
            const result = await chatService.deleteSession(req.params.id, req.user.id);
            return res.status(200).json({ message: req.t(result.message) });
        } catch (error) {
            next(error);
        }
    },

    renameSession: async (req, res, next) => {
        try {
            const result = await chatService.renameSession(req.params.id, req.user.id, req.body.title);
            return res.status(200).json({ message: req.t(result.message), title: result.title });
        } catch (error) {
            next(error);
        }
    },

    shareSession: async (req, res, next) => {
        try {
            const result = await chatService.shareSession(req.params.id, req.user.id);
            return res.status(200).json({ message: req.t(result.message), is_shared: result.is_shared });
        } catch (error) {
            next(error);
        }
    },

    getPublicSession: async (req, res, next) => {
        try {
            const result = await chatService.getPublicSession(req.params.id);
            return res.status(200).json(result.data);
        } catch (error) {
            next(error);
        }
    }
};

module.exports = chatController;