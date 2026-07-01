const groupService = require('../services/groupService');

const groupController = {
    // Create a new group
    createGroup: async (req, res, next) => {
        try {
            const result = await groupService.createGroup(req.body);
            return res.status(201).json(result.data);
        } catch (error) {
            next(error);
        }
    },

    // Get all groups
    getAllGroups: async (req, res, next) => {
        try {
            const result = await groupService.getAllGroups();
            return res.status(200).json(result.data);
        } catch (error) {
            next(error);
        }
    },

    // Get a single group by ID
    getGroupById: async (req, res, next) => {
        try {
            const result = await groupService.getGroupById(req.params.id);
            return res.status(200).json(result.data);
        } catch (error) {
            next(error);
        }
    },

    // Update a group
    updateGroup: async (req, res, next) => {
        try {
            // Truyền thêm mảng quyền của user hiện tại xuống service để chặn leo thang đặc quyền
            const result = await groupService.updateGroup(req.params.id, req.body, req.userPermissions);
            return res.status(200).json(result.data);
        } catch (error) {
            next(error);
        }
    },

    // Delete a group
    deleteGroup: async (req, res, next) => {
        try {
            const result = await groupService.deleteGroup(req.params.id);
            return res.status(200).json({ message: req.t(result.data.message) });
        } catch (error) {
            next(error);
        }
    },

    // Add/Invite users to a group
    addUsersToGroup: async (req, res, next) => {
        try {
            const { userIds } = req.body;
            const result = await groupService.addUsersToGroup(req.params.id, userIds);
            return res.status(200).json({ message: req.t(result.data.message) });
        } catch (error) {
            next(error);
        }
    },

    // Remove a user from a group
    removeUserFromGroup: async (req, res, next) => {
        try {
            const result = await groupService.removeUserFromGroup(req.params.id, req.params.userId);
            return res.status(200).json({ message: req.t(result.data.message) });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = groupController;
