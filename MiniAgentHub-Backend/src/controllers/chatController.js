const chatService = require('../services/chatService');
const catchAsync = require('../utils/catchAsync');

const chatController = {
    getSessions: catchAsync(async (req, res, next) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const sessions = await chatService.getSessions(req.user.id, page, limit);
        return res.status(200).json({
            data: sessions.rows,
            total: sessions.count,
            page,
            totalPages: Math.ceil(sessions.count / limit)
        });
    }),

    getSessionMessages: catchAsync(async (req, res, next) => {
        const messages = await chatService.getSessionMessages(req.params.id, req.user.id);
        return res.status(200).json(messages);
    }),

    deleteAllSessions: catchAsync(async (req, res, next) => {
        const result = await chatService.deleteAllSessions(req.user.id);
        return res.status(200).json({ message: req.t(result.message) });
    }),

    deleteSession: catchAsync(async (req, res, next) => {
        const result = await chatService.deleteSession(req.params.id, req.user.id);
        return res.status(200).json({ message: req.t(result.message) });
    }),

    renameSession: catchAsync(async (req, res, next) => {
        const result = await chatService.renameSession(req.params.id, req.user.id, req.body.title);
        return res.status(200).json({ message: req.t(result.message), title: result.title });
    }),

    shareSession: catchAsync(async (req, res, next) => {
        const result = await chatService.shareSession(req.params.id, req.user.id);
        return res.status(200).json({ message: req.t(result.message), is_shared: result.is_shared });
    }),

    getPublicSession: catchAsync(async (req, res, next) => {
        const result = await chatService.getPublicSession(req.params.id);
        return res.status(200).json(result.data);
    }),

    truncateLastAIMessage: catchAsync(async (req, res, next) => {
        const result = await chatService.truncateLastAIMessage(req.params.id, req.user.id, req.body.content);
        return res.status(200).json(result);
    })
};

module.exports = chatController;