const groupService = require('../services/groupService');
const catchAsync = require('../utils/catchAsync');

const groupController = {
    createGroup: catchAsync(async (req, res, next) => {
        const result = await groupService.createGroup(req.body);
        return res.status(201).json(result);
    }),

    getAllGroups: catchAsync(async (req, res, next) => {
        const result = await groupService.getAllGroups();
        return res.status(200).json(result);
    }),

    getGroupById: catchAsync(async (req, res, next) => {
        const result = await groupService.getGroupById(req.params.id);
        return res.status(200).json(result);
    }),

    updateGroup: catchAsync(async (req, res, next) => {
        const result = await groupService.updateGroup(req.params.id, req.body, req.userPermissions);
        return res.status(200).json(result);
    }),

    deleteGroup: catchAsync(async (req, res, next) => {
        const force = req.query.force === 'true';
        const result = await groupService.deleteGroup(req.params.id, force);
        return res.status(200).json({ message: req.t(result.message) });
    }),

    addUsersToGroup: catchAsync(async (req, res, next) => {
        const { userIds } = req.body;
        const result = await groupService.addUsersToGroup(req.params.id, userIds);
        return res.status(200).json({ message: req.t(result.message) });
    }),

    removeUserFromGroup: catchAsync(async (req, res, next) => {
        const result = await groupService.removeUserFromGroup(req.params.id, req.params.userId);
        return res.status(200).json({ message: req.t(result.message) });
    })
};

module.exports = groupController;
