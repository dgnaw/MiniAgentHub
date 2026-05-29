const groupService = require('../services/groupService');

const groupController = {
    // Create a new group
    createGroup: async (req, res) => {
        try {
            const result = await groupService.createGroup(req.body);
            if (result.error) {
                return res.status(result.status || 400).json({ message: result.error });
            }
            return res.status(result.status || 201).json(result.data);
        } catch (error) {
            console.error('Error in groupController.createGroup:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Get all groups
    getAllGroups: async (req, res) => {
        try {
            const result = await groupService.getAllGroups();
            return res.status(result.status || 200).json(result.data);
        } catch (error) {
            console.error('Error in groupController.getAllGroups:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Get a single group by ID
    getGroupById: async (req, res) => {
        try {
            const result = await groupService.getGroupById(req.params.id);
            if (result.error) {
                return res.status(result.status || 404).json({ message: result.error });
            }
            return res.status(result.status || 200).json(result.data);
        } catch (error) {
            console.error('Error in groupController.getGroupById:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Update a group
    updateGroup: async (req, res) => {
        try {
            // Truyền thêm mảng quyền của user hiện tại xuống service để chặn leo thang đặc quyền
            const result = await groupService.updateGroup(req.params.id, req.body, req.userPermissions);
            if (result.error) {
                return res.status(result.status || 400).json({ message: result.error });
            }
            return res.status(result.status || 200).json(result.data);
        } catch (error) {
            console.error('Error in groupController.updateGroup:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Delete a group
    deleteGroup: async (req, res) => {
        try {
            const result = await groupService.deleteGroup(req.params.id);
            if (result.error) {
                return res.status(result.status || 400).json({ message: result.error });
            }
            return res.status(result.status || 200).json(result.data);
        } catch (error) {
            console.error('Error in groupController.deleteGroup:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Add/Invite users to a group
    addUsersToGroup: async (req, res) => {
        try {
            const { userIds } = req.body;
            const result = await groupService.addUsersToGroup(req.params.id, userIds);
            if (result.error) {
                return res.status(result.status || 400).json({ message: result.error });
            }
            return res.status(result.status || 200).json(result.data);
        } catch (error) {
            console.error('Error in groupController.addUsersToGroup:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Remove a user from a group
    removeUserFromGroup: async (req, res) => {
        try {
            const result = await groupService.removeUserFromGroup(req.params.id, req.params.userId);
            if (result.error) {
                return res.status(result.status || 400).json({ message: result.error });
            }
            return res.status(result.status || 200).json(result.data);
        } catch (error) {
            console.error('Error in groupController.removeUserFromGroup:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }
};

module.exports = groupController;
