const { User, Group, Role, UserGroup, Permission, RolePermission, GroupPermission } = require('../models');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sequelize } = require('../config/database');

const { sendWelcomeEmail } = require('../utils/emailService');
const AppError = require('../utils/AppError');

const userService = {
    createUser: async ({ email, full_name, phone, address, role_id, role_name, group_ids }, lng = 'vi') => {
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            throw new AppError('user.emailExists', 409);
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
                throw new AppError('user.roleNotFound', 404);
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
                const groupCount = await Group.count({ where: { id: group_ids } });
                if (groupCount !== group_ids.length) {
                    throw new AppError('user.invalidGroupId', 400);
                }
                const userGroupRecords = group_ids.map(gId => ({ user_id: newUser.id, group_id: gId }));
                await UserGroup.bulkCreate(userGroupRecords, { transaction });
            }

            try {
                await sendWelcomeEmail(email, full_name, rawPassword, lng);
            } catch (mailError) {
                console.error('Lỗi gửi email cấp phát:', mailError);
                throw new AppError('user.emailSendFailed', 500);
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

    getAllUsers: async () => {
        return await User.findAll({
            attributes: { exclude: ['password_hash'] },
            include: [
                { model: Role, attributes: ['id', 'name'] },
                {
                    model: Group,
                    attributes: ['id', 'name'],
                    through: { attributes: [] }
                }
            ],
            order: [['created_at', 'DESC']]
        });
    },

    getUserById: async (id) => {
        const user = await User.findByPk(id, {
            attributes: { exclude: ['password_hash'] },
            include: [
                { model: Role, attributes: ['id', 'name'] },
                {
                    model: Group,
                    attributes: ['id', 'name'],
                    through: { attributes: [] }
                }
            ]
        });
        if (!user) {
            throw new AppError('user.notFound', 404);
        }

        const roleId = user.role_id;
        let rolePermissionIds = [];
        if (roleId) {
            const rolePerms = await RolePermission.findAll({
                where: { role_id: roleId }
            });
            rolePermissionIds = rolePerms.map(rp => rp.permission_id);
        }

        const userGroups = await UserGroup.findAll({
            where: { user_id: user.id }
        });
        const groupIds = userGroups.map(ug => ug.group_id);

        let groupPermissionIds = [];
        if (groupIds.length > 0) {
            const groupPerms = await GroupPermission.findAll({ where: { group_id: groupIds } });
            groupPermissionIds = groupPerms.map(gp => gp.permission_id);
        }

        const allPermissionIds = [...new Set([...rolePermissionIds, ...groupPermissionIds])];
        let userPermissions = [];
        if (allPermissionIds.length > 0) {
            const permissionsList = await Permission.findAll({ where: { id: allPermissionIds } });
            userPermissions = permissionsList.map(p => p.permission_key);
        }

        return { 
            data: { 
                user, 
                permissions: userPermissions 
            }, 
            status: 200 
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
            throw new AppError('user.notFound', 404);
        }

        const { full_name, phone, address, role_id, role_name, role, is_active, group_ids, groq_api_key, flowise_api_url } = updateData;

        let targetRoleId = role_id;
        const targetRoleName = role_name || role;

        if (user.Role && user.Role.name === 'Admin') {
            if (targetRoleId || targetRoleName || is_active === false) {
                throw new AppError('user.cannotDemoteAdmin', 403);
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
                throw new AppError('user.roleNotFound', 404);
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
                if (group_ids.length > 0) {
                    const groupCount = await Group.count({ where: { id: group_ids } });
                    if (groupCount !== group_ids.length) {
                        throw new AppError('user.invalidGroupId', 400);
                    }
                }
                await UserGroup.destroy({ where: { user_id: id }, transaction });

                if (group_ids.length > 0) {
                    const userGroupRecords = group_ids.map(gId => ({ user_id: id, group_id: gId }));
                    await UserGroup.bulkCreate(userGroupRecords, { transaction });
                }
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }

        return { data: user, status: 200 };
    },

    deleteUser: async (id) => {
        const user = await User.findByPk(id, {
            include: [{ model: Role, attributes: ['name'] }]
        });
        if (!user) {
            throw new AppError('user.notFound', 404);
        }

        if (user.Role && user.Role.name === 'Admin') {
            throw new AppError('user.cannotDeleteAdmin', 403);
        }

        await user.destroy();
        return { data: { message: 'user.deleteSuccess' }, status: 200 };
    },

    changePassword: async (userId, oldPassword, newPassword) => {
        const user = await User.findByPk(userId);
        if (!user) {
            throw new AppError('user.notFound', 404);
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isMatch) {
            throw new AppError('auth.oldPasswordIncorrect', 400);
        }

        const password_hash = await bcrypt.hash(newPassword, 10);
        user.password_hash = password_hash;
        user.is_first_login = false;
        await user.save();
        return true;
    }
};

module.exports = userService;