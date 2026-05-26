const { Group, UserGroup, Permission, GroupPermission } = require('../models');
const { Sequelize } = require('sequelize');

const groupService = {
    createGroup: async (groupData) => {
        const { name, description } = groupData;
        
        if (!name || !name.trim()) {
            return { error: 'Group name is required', status: 400 };
        }

        const trimmedName = name.trim();
        const existingGroup = await Group.findOne({ where: { name: trimmedName } });
        if (existingGroup) {
            return { error: 'Group with this name already exists', status: 409 };
        }

        const cleanDescription = description?.trim() || null;
        const newGroup = await Group.create({ name: trimmedName, description: cleanDescription });

        const defaultPermissionKeys = ['CHAT', 'CONV_C', 'CONV_R', 'CONV_U', 'CONV_D'];
        const defaultPermissions = await Permission.findAll({
            where: {
                permission_key: defaultPermissionKeys
            },
            attributes: ['id']
        });

        if (defaultPermissions.length > 0) {
            const groupPermissionRecords = defaultPermissions.map(p => ({
                group_id: newGroup.id,
                permission_id: p.id
            }));
            await GroupPermission.bulkCreate(groupPermissionRecords);
        }

        return { data: newGroup, status: 201 };
    },

    getAllGroups: async () => {
        const groups = await Group.findAll({
            attributes: {
                include: [
                    [
                        Sequelize.literal(`(
                            SELECT COUNT(*)::int
                            FROM user_groups
                            WHERE user_groups.group_id = "Group"."id"
                        )`),
                        'member_count'
                    ]
                ]
            },
            order: [['created_at', 'DESC']] 
        });
        return { data: groups, status: 200 };
    },

    getGroupById: async (id) => {
        const group = await Group.findByPk(id);

        if (!group) {
            return { error: 'Group not found', status: 404 };
        }

        return { data: group, status: 200 };
    },

    updateGroup: async (id, groupData) => {
        const { name, description } = groupData;

        const group = await Group.findByPk(id);

        if (!group) {
            return { error: 'Group not found', status: 404 };
        }

        if (name && name.trim()) {
            const trimmedName = name.trim();
            const existingGroup = await Group.findOne({ where: { name: trimmedName } });
            if (existingGroup && existingGroup.id.toString() !== id.toString()) {
                return { error: 'Another group with this name already exists', status: 409 };
            }
            group.name = trimmedName;
        }
        if (description !== undefined) {
            group.description = description?.trim() || null;
        }

        await group.save();
        return { data: group, status: 200 };
    },

    deleteGroup: async (id) => {
        const group = await Group.findByPk(id);

        if (!group) {
            return { error: 'Group not found', status: 404 };
        }

        const userCount = await UserGroup.count({ where: { group_id: id } });
        
        if (userCount > 0) {
            return { 
                error: `Không thể xóa! Đang có ${userCount} người dùng thuộc nhóm này. Hãy chuyển họ sang nhóm khác trước.`,
                status: 400 
            };
        }

        await group.destroy();
        return { data: { message: 'Group deleted successfully' }, status: 200 };
    },

    addUsersToGroup: async (id, userIds) => {
        const group = await Group.findByPk(id);
        if (!group) {
            return { error: 'Group not found', status: 404 };
        }

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return { error: 'Danh sách userIds không hợp lệ', status: 400 };
        }

        const existingMembers = await UserGroup.findAll({ where: { group_id: id } });
        const existingUserIds = existingMembers.map(m => m.user_id);

        const newUsers = userIds.filter(uid => !existingUserIds.includes(uid));

        if (newUsers.length > 0) {
            const records = newUsers.map(userId => ({ user_id: userId, group_id: id }));
            await UserGroup.bulkCreate(records);
        }

        return { data: { message: 'Đã thêm người dùng vào nhóm thành công' }, status: 200 };
    },

    removeUserFromGroup: async (id, userId) => {
        const group = await Group.findByPk(id);
        if (!group) {
            return { error: 'Group not found', status: 404 };
        }

        const deletedCount = await UserGroup.destroy({
            where: { group_id: id, user_id: userId }
        });

        if (deletedCount === 0) {
            return { error: 'Người dùng này không thuộc nhóm', status: 400 };
        }

        return { data: { message: 'Đã xóa người dùng khỏi nhóm' }, status: 200 };
    }
};

module.exports = groupService;
