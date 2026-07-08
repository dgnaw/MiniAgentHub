const { Group, UserGroup, Permission, GroupPermission, User } = require('../models');
const redisClient = require('../config/redis');
const { Sequelize } = require('sequelize');
const AppError = require('../utils/AppError');
const { sequelize } = require('../config/database');

const invalidateGroupUsersCache = async (groupId, additionalUserIds = []) => {
    try {
        const userGroups = await UserGroup.findAll({ where: { group_id: groupId }});
        const userIds = [...new Set([...userGroups.map(ug => ug.user_id), ...additionalUserIds])];
        if (userIds.length > 0) {
            const pipeline = redisClient.pipeline();
            userIds.forEach(id => pipeline.del(`user:${id}:permissions`));
            await pipeline.exec();
        }
    } catch (error) {
        console.error('Lỗi khi xóa cache cho group:', error);
    }
};

const groupService = {
    createGroup: async (groupData) => {
        const { name, description, userIds, permissions, entityType = 'users' } = groupData;

        if (!name || !name.trim()) {
            throw new AppError('group.nameRequired', 'BAD_REQUEST');
        }

        const trimmedName = name.trim();
        const existingGroup = await Group.findOne({ where: { name: trimmedName } });
        if (existingGroup) {
            throw new AppError('group.nameExists', 'CONFLICT');
        }

        const cleanDescription = description?.trim() || null;

        const transaction = await sequelize.transaction();
        let newGroup;
        try {
            newGroup = await Group.create({ name: trimmedName, description: cleanDescription }, { transaction });

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
                await GroupPermission.bulkCreate(groupPermissionRecords, { transaction });
            }

            if (Array.isArray(userIds) && userIds.length > 0) {
                const userGroupRecords = userIds.map(userId => ({
                    group_id: newGroup.id,
                    user_id: userId
                }));
                await UserGroup.bulkCreate(userGroupRecords, { transaction });
            }

            await transaction.commit();
            await redisClient.del('cache:groups');
            if (Array.isArray(userIds) && userIds.length > 0) {
                await invalidateGroupUsersCache(newGroup.id, userIds);
            }
        } catch (error) {
            await transaction.rollback();
            throw error;
        }

        return newGroup;
    },

    getAllGroups: async () => {
        const cachedGroups = await redisClient.get('cache:groups');
        if (cachedGroups) return JSON.parse(cachedGroups);

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
            include: [{
                model : Permission,
                attributes: ['permission_key'],
                through: { attributes: [] }
            }],
            order: [['created_at', 'DESC']]
        });

        const groupsWithPerms = groups.map(g => {
            const groupData = g.get({ plain: true });
            const permissions = { create: false, read: false,
                update: false, delete:false};
            
            let entityType = 'users';

            if (groupData.Permissions) {
                groupData.Permissions.forEach(p => {
                    const key = p.permission_key;
                    if (key?.endsWith('_C')) permissions.create = true;
                    if (key?.endsWith('_R')) permissions.read = true;
                    if (key?.endsWith('_U')) permissions.update = true;
                    if (key?.endsWith('_D')) permissions.delete = true;
                    if (key?.startsWith('GROUP_')) entityType = 'groups';
                    if (key?.startsWith('USER_')) entityType = 'users';
                });
            }
            delete groupData.Permissions;
                return {
                    ...groupData,
                    permissions,
                    entityType
                };
            });
            
        await redisClient.setex('cache:groups', 86400, JSON.stringify(groupsWithPerms)); // Cache 24h
        return groupsWithPerms;
    },

    getGroupById: async (id) => {
        const group = await Group.findByPk(id, {
            include: [{
                model: User,
                attributes: ['id', 'full_name', 'email'],
                through: { attributes: [] }
            }]
        });

        if (!group) {
            throw new AppError('group.notFound', 'NOT_FOUND');
        }

        const groupData = group.get({ plain: true });
        groupData.members = groupData.Users || [];
        delete groupData.Users;

        return groupData;
    },

    updateGroup: async (id, groupData) => {
        const { name, description, permissions, entityType = 'users', userIds } = groupData;

        const group = await Group.findByPk(id);

        if (!group) {
            throw new AppError('group.notFound', 'NOT_FOUND');
        }

        const transaction = await sequelize.transaction();
        try {
            if (name && name.trim()) {
                const trimmedName = name.trim();
                const existingGroup = await Group.findOne({ where: { name: trimmedName } });
                if (existingGroup && existingGroup.id.toString() !== id.toString()) {
                    throw new AppError('group.nameExists', 'CONFLICT');
                }
                group.name = trimmedName;
            }
            if (description !== undefined) {
                group.description = description?.trim() || null;
            }

            await group.save({ transaction });

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

                await GroupPermission.destroy({ where: { group_id: id }, transaction });
                if (assignedPermissions.length > 0) {
                    await GroupPermission.bulkCreate(
                        assignedPermissions.map(p => ({ group_id: id, permission_id: p.id })),
                        { transaction }
                    );
                }
            }

            if (Array.isArray(userIds)) {
                await UserGroup.destroy({ where: { group_id: id }, transaction });
                if (userIds.length > 0) {
                    const records = userIds.map(uid => ({ group_id: id, user_id: uid }));
                    await UserGroup.bulkCreate(records, { transaction });
                }
            }

            await transaction.commit();
            await redisClient.del('cache:groups');
            await invalidateGroupUsersCache(id, Array.isArray(userIds) ? userIds : []);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }

        return group;
    },

    deleteGroup: async (id) => {
        const group = await Group.findByPk(id);

        if (!group) {
            throw new AppError('group.notFound', 'NOT_FOUND');
        }

        const userCount = await UserGroup.count({ where: { group_id: id } });

        if (userCount > 0) {
            throw new AppError('group.deleteHasUsers', 'BAD_REQUEST', { count: userCount });
        }

        const transaction = await sequelize.transaction();
        try {
            await GroupPermission.destroy({ where: { group_id: id }, transaction});
            await group.destroy( { transaction} );
            await transaction.commit();
            await redisClient.del('cache:groups');
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
        return { message: 'group.deleteSuccess' };
    },

    addUsersToGroup: async (id, userIds) => {
        const group = await Group.findByPk(id);
        if (!group) {
            throw new AppError('group.notFound', 'NOT_FOUND');
        }

        if (!Array.isArray(userIds) || userIds.length === 0) {
            throw new AppError('group.invalidUserIds', 'BAD_REQUEST');
        }

        const existingMembers = await UserGroup.findAll({ where: { group_id: id } });
        const existingUserIds = existingMembers.map(m => m.user_id);

        const newUsers = userIds.filter(uid => !existingUserIds.includes(uid));

        if (newUsers.length > 0) {
            const records = newUsers.map(userId => ({ user_id: userId, group_id: id }));
            await UserGroup.bulkCreate(records);
            await invalidateGroupUsersCache(id, newUsers);
        }

        return { message: 'group.addUsersSuccess' };
    },

    removeUserFromGroup: async (id, userId) => {
        const group = await Group.findByPk(id);
        if (!group) {
            throw new AppError('group.notFound', 'NOT_FOUND');
        }

        const deletedCount = await UserGroup.destroy({
            where: { group_id: id, user_id: userId }
        });

        if (deletedCount === 0) {
            throw new AppError('group.userNotInGroup', 'BAD_REQUEST');
        }

        await redisClient.del(`user:${userId}:permissions`);

        return { message: 'group.removeUserSuccess' };
    }
};

module.exports = groupService;
