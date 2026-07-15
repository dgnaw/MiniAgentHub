const { User, Group, Role, UserGroup, Permission } = require('../models');
const cacheHelper = require('../utils/cacheHelper');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sequelize } = require('../config/database');
const { Sequelize } = require('sequelize');

const { sendWelcomeEmail } = require('../utils/emailService');
const { emailQueue } = require('../config/queue');
const AppError = require('../utils/AppError');

const userService = {
    createUser: async ({ email, full_name, phone, address, role_id, role_name, group_ids }, lng = 'vi') => {
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            throw new AppError('user.emailExists', 'CONFLICT');
        }

        let targetRoleId = role_id;

        if (role_name) {
            const roleRecord = await Role.findOne({ where: { name: role_name } });
            if (roleRecord) targetRoleId = roleRecord.id;
        }

        const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetRoleId);

        if (targetRoleId && isValidUUID) {
            const roleExist = await Role.findByPk(targetRoleId);
            if (!roleExist) {
                throw new AppError('user.roleNotFound', 'NOT_FOUND');
            }
        } else {
            const defaultRole = await Role.findOne({ where: { name: 'User' } });
            if (defaultRole) targetRoleId = defaultRole.id;
        }

        const rawPassword = crypto.randomBytes(4).toString('hex');
        const password_hash = await bcrypt.hash(rawPassword, 10);

        const transaction = await sequelize.transaction();
        try {
            const newUser = await User.create({
                email,
                full_name,
                phone: phone || null,
                address: address || null,
                role_id: targetRoleId || null,
                password_hash
            }, { transaction });

            if (group_ids && Array.isArray(group_ids) && group_ids.length > 0) {
                const uniqueGroupIds = [...new Set(group_ids)];
                const groupCount = await Group.count({ where: { id: uniqueGroupIds } });
                if (groupCount !== uniqueGroupIds.length) {
                    throw new AppError('user.invalidGroupId', 'BAD_REQUEST');
                }
                const userGroupRecords = uniqueGroupIds.map(gId => ({ user_id: newUser.id, group_id: gId }));
                await UserGroup.bulkCreate(userGroupRecords, { transaction });
            }

            try {
                await emailQueue.add('welcomeEmail', { 
                    email, 
                    full_name, 
                    password: rawPassword, 
                    lng 
                });
            } catch (mailError) {
                console.error('Lỗi khi đưa email vào hàng đợi:', mailError);
            }

            await transaction.commit();

            return {
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    full_name: newUser.full_name,
                    role_id: newUser.role_id,
                    is_active: newUser.is_active,
                },
                emailSent: true
            };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },

    getAllUsers: async (page = 1, limit = 10) => {
        const offset = (page - 1) * limit;
        const users = await User.findAndCountAll({
            attributes: { exclude: ['password_hash'] },
            include: [
                { model: Role, attributes: ['id', 'name'] },
                {
                    model: Group,
                    attributes: {
                        include: [
                            [
                                Sequelize.literal(`(
                                    SELECT COUNT(*)::int
                                    FROM user_groups
                                    WHERE user_groups.group_id = "Groups"."id"
                                )`),
                                'member_count'
                            ]
                        ]
                    },
                    through: { attributes: [] }
                }
            ],
            order: [['created_at', 'DESC']],
            limit,
            offset,
            distinct: true
        });

        return users;
    },

    getUserById: async (id) => {
        const user = await User.findByPk(id, {
            attributes: { exclude: ['password_hash'] },
            include: [
                {
                    model: Role,
                    attributes: ['id', 'name'],
                    include: [{
                        model: Permission,
                        attributes: ['permission_key'],
                        through: { attributes: [] }
                    }]
                },
                {
                    model: Group,
                    attributes: {
                        include: [
                            [
                                Sequelize.literal(`(
                                    SELECT COUNT(*)::int
                                    FROM user_groups
                                    WHERE user_groups.group_id = "Groups"."id"
                                )`),
                                'member_count'
                            ]
                        ]
                    },
                    through: { attributes: [] },
                    include: [{
                        model: Permission,
                        attributes: ['permission_key'],
                        through: { attributes: [] }
                    }]
                }
            ]
        });
        if (!user) {
            throw new AppError('user.notFound', 'NOT_FOUND');
        }

        const userData = user.get({ plain: true });
        const permissionSet = new Set();

        if (userData.Role && userData.Role.Permissions) {
            userData.Role.Permissions.forEach(p =>
                permissionSet.add(p.permission_key));
            delete userData.Role.Permissions;
        }

        if (userData.Groups) {
            userData.Groups.forEach(g => {
                if (g.Permissions) {
                    g.Permissions.forEach(p => permissionSet.add(p.permission_key));
                    delete g.Permissions;
                }
            });
        }

        return {
            user: userData,
            permissions: Array.from(permissionSet)
        };
    },

    getUserApiKeys: async (id) => {
        const user = await User.findByPk(id, { attributes: ['groq_api_key', 'flowise_api_url'] });
        return {
            groq_api_key: user?.groq_api_key || null,
            flowise_api_url: user?.flowise_api_url || null
        };
    },

    updateUser: async (id, updateData) => {
        const user = await User.findByPk(id, {
            include: [{ model: Role, attributes: ['name'] }]
        });
        if (!user) {
            throw new AppError('user.notFound', 'NOT_FOUND');
        }

        const { full_name, phone, address, role_id, role_name, role, is_active, group_ids, groq_api_key, flowise_api_url } = updateData;

        let targetRoleId = role_id;
        const targetRoleName = role_name || role;

        if (user.Role && user.Role.name === 'Admin') {
            if (targetRoleId || targetRoleName || is_active === false) {
                throw new AppError('user.cannotDemoteAdmin', 'FORBIDDEN');
            }
        }

        if (targetRoleName) {
            const roleRecord = await Role.findOne({ where: { name: targetRoleName } });
            if (roleRecord) targetRoleId = roleRecord.id;
        }

        const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetRoleId);

        if (targetRoleId !== undefined && isValidUUID) {
            const roleExist = await Role.findByPk(targetRoleId);
            if (!roleExist) {
                throw new AppError('user.roleNotFound', 'NOT_FOUND');
            }
        }

        const transaction = await sequelize.transaction();
        try {
            if (full_name !== undefined) user.full_name = full_name.trim();
            if (phone !== undefined) user.phone = phone?.trim() || null;
            if (address !== undefined) user.address = address?.trim() || null;
            if (is_active !== undefined) user.is_active = is_active;
            if (groq_api_key !== undefined) user.groq_api_key = groq_api_key?.trim() || null;
            if (flowise_api_url !== undefined) user.flowise_api_url = flowise_api_url?.trim() || null;

            if (targetRoleId !== undefined && isValidUUID) {
                user.role_id = targetRoleId;
            }

            await user.save({ transaction });

            if (group_ids && Array.isArray(group_ids)) {
                const uniqueGroupIds = [...new Set(group_ids)];
                if (uniqueGroupIds.length > 0) {
                    const groupCount = await Group.count({ where: { id: uniqueGroupIds } });
                    if (groupCount !== uniqueGroupIds.length) {
                        throw new AppError('user.invalidGroupId', 'BAD_REQUEST');
                    }
                }
                await UserGroup.destroy({ where: { user_id: id }, transaction });

                if (uniqueGroupIds.length > 0) {
                    const userGroupRecords = uniqueGroupIds.map(gId => ({ user_id: id, group_id: gId }));
                    await UserGroup.bulkCreate(userGroupRecords, { transaction });
                }
            }

            await cacheHelper.del(`user:${id}:permissions`);
            await cacheHelper.del(`user:${id}:status`);

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }

        return user;
    },

    deleteUser: async (id, force = false) => {
        const user = await User.findByPk(id, {
            include: [{ model: Role, attributes: ['name'] }]
        });
        if (!user) {
            throw new AppError('user.notFound', 'NOT_FOUND');
        }

        if (user.Role && user.Role.name === 'Admin') {
            throw new AppError('user.cannotDeleteAdmin', 'FORBIDDEN');
        }

        const userGroupCount = await UserGroup.count({ where: { user_id: id } });
        if (userGroupCount > 0 && !force) {
            throw new AppError('user.deleteHasGroups', 'BAD_REQUEST');
        }

        const transaction = await sequelize.transaction();
        try {
            if (force && userGroupCount > 0) {
                await UserGroup.destroy({ where: { user_id: id }, transaction });
            }
            await User.destroy({ where: { id: id }, transaction });
            await cacheHelper.del(`user:${id}:permissions`);
            await cacheHelper.del(`user:${id}:status`);

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }

        return { message: 'user.deleteSuccess' };
    },

    changePassword: async (userId, oldPassword, newPassword) => {
        const user = await User.findByPk(userId);
        if (!user) {
            throw new AppError('user.notFound', 'NOT_FOUND');
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isMatch) {
            throw new AppError('auth.oldPasswordIncorrect', 'BAD_REQUEST');
        }

        const password_hash = await bcrypt.hash(newPassword, 10);
        user.password_hash = password_hash;
        user.is_first_login = false;
        await user.save();
        return true;
    }
};

module.exports = userService;