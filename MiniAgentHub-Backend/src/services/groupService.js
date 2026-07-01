const { Group, UserGroup, Permission, GroupPermission, User } = require('../models');
const { Sequelize } = require('sequelize');

const groupService = {
    createGroup: async (groupData) => {
        const { name, description, userIds, permissions, entityType = 'users' } = groupData;
        
        if (!name || !name.trim()) {
            return { error: 'group.nameRequired', status: 400 };
        }

        const trimmedName = name.trim();
        const existingGroup = await Group.findOne({ where: { name: trimmedName } });
        if (existingGroup) {
            return { error: 'group.nameExists', status: 409 };
        }

        const cleanDescription = description?.trim() || null;
        const newGroup = await Group.create({ name: trimmedName, description: cleanDescription });

        let keysToFind = ['CHAT']; 
        const prefix = entityType === 'groups' ? 'GROUP' : 'USER';

        if (permissions) {
            if (permissions.create) keysToFind.push(`${prefix}_C`);
            if (permissions.read) keysToFind.push(`${prefix}_R`);
            if (permissions.update) keysToFind.push(`${prefix}_U`);
            if (permissions.delete) keysToFind.push(`${prefix}_D`);
        } else {
            keysToFind = ['CHAT', `${prefix}_C`, `${prefix}_R`, `${prefix}_U`, `${prefix}_D`];
        }

        const assignedPermissions = await Permission.findAll({
            where: {
                permission_key: keysToFind
            },
            attributes: ['id']
        });

        if (assignedPermissions.length > 0) {
            const groupPermissionRecords = assignedPermissions.map(p => ({
                group_id: newGroup.id,
                permission_id: p.id
            }));
            await GroupPermission.bulkCreate(groupPermissionRecords);
        }

        if (Array.isArray(userIds) && userIds.length > 0) {
            const userGroupRecords = userIds.map(userId => ({
                group_id: newGroup.id,
                user_id: userId
            }));
            await UserGroup.bulkCreate(userGroupRecords);
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

        const groupIds = groups.map(g => g.id);
        if (groupIds.length === 0) {
            return { data: [], status: 200 };
        }

        const groupPerms = await GroupPermission.findAll({
            where: { group_id: groupIds }
        });
        
        const permIds = [...new Set(groupPerms.map(gp => gp.permission_id))];
        const permissions = await Permission.findAll({
            where: { id: permIds }
        });

        const permIdToKey = {};
        permissions.forEach(p => permIdToKey[p.id] = p.permission_key);

        const groupPermMap = {};
        const entityMap = {};
        groupIds.forEach(id => groupPermMap[id] = { create: false, read: false, update: false, delete: false });
        groupPerms.forEach(gp => {
            const key = permIdToKey[gp.permission_id];
            if (key?.endsWith('_C')) groupPermMap[gp.group_id].create = true;
            if (key?.endsWith('_R')) groupPermMap[gp.group_id].read = true;
            if (key?.endsWith('_U')) groupPermMap[gp.group_id].update = true;
            if (key?.endsWith('_D')) groupPermMap[gp.group_id].delete = true;

            if (key?.startsWith('GROUP_')) entityMap[gp.group_id] = 'groups';
            if (key?.startsWith('USER_')) entityMap[gp.group_id] = 'users';
        });

        const groupsWithPerms = groups.map(g => ({ ...g.get({ plain: true }), permissions: groupPermMap[g.id], entityType: entityMap[g.id] || 'users' }));
        return { data: groupsWithPerms, status: 200 };
    },

    getGroupById: async (id) => {
        const group = await Group.findByPk(id);

        if (!group) {
            return { error: 'group.notFound', status: 404 };
        }

        const userGroups = await UserGroup.findAll({ where: { group_id: id } });
        const userIds = userGroups.map(ug => ug.user_id);
        
        let members = [];
        if (userIds.length > 0 && User) {
            members = await User.findAll({
                where: { id: userIds },
                attributes: ['id', 'full_name', 'email']
            });
        }

        const groupData = group.get ? group.get({ plain: true }) : group;
        groupData.members = members;

        return { data: groupData, status: 200 };
    },

    updateGroup: async (id, groupData) => {
        const { name, description, permissions, entityType = 'users', userIds } = groupData;

        const group = await Group.findByPk(id);

        if (!group) {
            return { error: 'group.notFound', status: 404 };
        }

        if (name && name.trim()) {
            const trimmedName = name.trim();
            const existingGroup = await Group.findOne({ where: { name: trimmedName } });
            if (existingGroup && existingGroup.id.toString() !== id.toString()) {
                return { error: 'group.nameExists', status: 409 };
            }
            group.name = trimmedName;
        }
        if (description !== undefined) {
            group.description = description?.trim() || null;
        }

        await group.save();

        if (permissions) {
            let keysToFind = ['CHAT'];
            const prefix = entityType === 'groups' ? 'GROUP' : 'USER';
            if (permissions.create) keysToFind.push(`${prefix}_C`);
            if (permissions.read) keysToFind.push(`${prefix}_R`);
            if (permissions.update) keysToFind.push(`${prefix}_U`);
            if (permissions.delete) keysToFind.push(`${prefix}_D`);

            const assignedPermissions = await Permission.findAll({
                where: { permission_key: keysToFind },
                attributes: ['id']
            });

            await GroupPermission.destroy({ where: { group_id: id } });
            if (assignedPermissions.length > 0) {
                await GroupPermission.bulkCreate(assignedPermissions.map(p => ({ group_id: id, permission_id: p.id })));
            }
        }

        if (Array.isArray(userIds)) {
            await UserGroup.destroy({ where: { group_id: id } }); 
            if (userIds.length > 0) {
                const records = userIds.map(uid => ({ group_id: id, user_id: uid }));
                await UserGroup.bulkCreate(records);
            }
        }

        return { data: group, status: 200 };
    },

    deleteGroup: async (id) => {
        const group = await Group.findByPk(id);

        if (!group) {
            return { error: 'group.notFound', status: 404 };
        }

        const userCount = await UserGroup.count({ where: { group_id: id } });
        
        if (userCount > 0) {
            return { 
                error: 'group.deleteHasUsers', 
                errorParams: { count: userCount },
                status: 400 
            };
        }

        await group.destroy();
        return { data: { message: 'group.deleteSuccess' }, status: 200 };
    },

    addUsersToGroup: async (id, userIds) => {
        const group = await Group.findByPk(id);
        if (!group) {
            return { error: 'group.notFound', status: 404 };
        }

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return { error: 'group.invalidUserIds', status: 400 };
        }

        const existingMembers = await UserGroup.findAll({ where: { group_id: id } });
        const existingUserIds = existingMembers.map(m => m.user_id);

        const newUsers = userIds.filter(uid => !existingUserIds.includes(uid));

        if (newUsers.length > 0) {
            const records = newUsers.map(userId => ({ user_id: userId, group_id: id }));
            await UserGroup.bulkCreate(records);
        }

        return { data: { message: 'group.addUsersSuccess' }, status: 200 };
    },

    removeUserFromGroup: async (id, userId) => {
        const group = await Group.findByPk(id);
        if (!group) {
            return { error: 'group.notFound', status: 404 };
        }

        const deletedCount = await UserGroup.destroy({
            where: { group_id: id, user_id: userId }
        });

        if (deletedCount === 0) {
            return { error: 'group.userNotInGroup', status: 400 };
        }

        return { data: { message: 'group.removeUserSuccess' }, status: 200 };
    }
};

module.exports = groupService;
