const { User, Group, Role, UserGroup, Permission, RolePermission, GroupPermission } = require('../models');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const { sendWelcomeEmail } = require('../utils/emailService');

const userService = {
    createUser: async ({ email, full_name, phone, address, role_id, role_name, group_ids }) => {
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return { error: 'User with this email already exists', status: 409 };
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
                return { error: 'Role not found', status: 404 };
            }
        } else {
            const defaultRole = await Role.findOne({ where: { name: 'User' } });
            if (defaultRole) targetRoleId = defaultRole.id;
        }

        const rawPassword = crypto.randomBytes(4).toString('hex');
        const password_hash = await bcrypt.hash(rawPassword, 10);

        const newUser = await User.create({
            email,
            full_name,
            phone: phone || null,
            address: address || null,
            role_id: targetRoleId || null,
            password_hash
        });

        if (group_ids && Array.isArray(group_ids) && group_ids.length > 0) {
            const groupCount = await Group.count({ where: { id: group_ids } });
            if (groupCount !== group_ids.length) {
                return { error: 'Một hoặc nhiều Group ID không hợp lệ.', status: 400 };
            }
            const userGroupRecords = group_ids.map(gId => ({ user_id: newUser.id, group_id: gId }));
            await UserGroup.bulkCreate(userGroupRecords);
        }

        let emailSent = true;
        try {
            await sendWelcomeEmail(email, full_name, rawPassword);
        } catch (mailError) {
            console.error('Lỗi gửi email cấp phát:', mailError);

            await UserGroup.destroy({ where: { user_id: newUser.id } });
            await User.destroy({ where: { id: newUser.id } });

            return { error: 'Không thể gửi email chứa mật khẩu. Quá trình tạo người dùng đã bị hủy (rollback). Vui lòng kiểm tra lại cấu hình SMTP (.env).', status: 500 };
        }

        return {
            user: {
                id: newUser.id,
                email: newUser.email,
                full_name: newUser.full_name,
                role_id: newUser.role_id,
                is_active: newUser.is_active,
            },
            emailSent,
            rawPassword
        };
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
            return { error: 'User not found', status: 404 };
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

    updateUser: async (id, updateData) => {
        const user = await User.findByPk(id);
        if (!user) {
            return { error: 'User not found', status: 404 };
        }

        const { full_name, phone, address, role_id, role_name, role, is_active, group_ids } = updateData;

        if (full_name !== undefined) user.full_name = full_name.trim();
        if (phone !== undefined) user.phone = phone?.trim() || null;
        if (address !== undefined) user.address = address?.trim() || null;
        if (is_active !== undefined) user.is_active = is_active;

        let targetRoleId = role_id;
        const targetRoleName = role_name || role;

        if (targetRoleName) {
            const roleRecord = await Role.findOne({ where: { name: targetRoleName } });
            if (roleRecord) targetRoleId = roleRecord.id;
        }

        const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetRoleId);

        if (targetRoleId !== undefined && isValidUUID) {
            const roleExist = await Role.findByPk(targetRoleId);
            if (!roleExist) {
                return { error: 'Role not found', status: 404 };
            }
            user.role_id = targetRoleId;
        }

        await user.save();

        if (group_ids && Array.isArray(group_ids)) {
            if (group_ids.length > 0) {
                const groupCount = await Group.count({ where: { id: group_ids } });
                if (groupCount !== group_ids.length) {
                    return { error: 'Một hoặc nhiều Group ID không hợp lệ.', status: 400 };
                }
            }
            await UserGroup.destroy({ where: { user_id: id } });

            if (group_ids.length > 0) {
                const userGroupRecords = group_ids.map(gId => ({ user_id: id, group_id: gId }));
                await UserGroup.bulkCreate(userGroupRecords);
            }
        }

        return { data: user, status: 200 };
    },

    deleteUser: async (id) => {
        const user = await User.findByPk(id);
        if (!user) {
            return { error: 'User not found', status: 404 };
        }

        await user.destroy();
        return { data: { message: 'User deleted successfully' }, status: 200 };
    },

    changePassword: async (userId, oldPassword, newPassword) => {
        const user = await User.findByPk(userId);
        if (!user) {
            const error = new Error('Người dùng không tồn tại!');
            error.status = 404;
            throw error;
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isMatch) {
            const error = new Error('Mật khẩu cũ không chính xác!');
            error.status = 400;
            throw error;
        }

        const password_hash = await bcrypt.hash(newPassword, 10);
        user.password_hash = password_hash;
        user.is_first_login = false;
        await user.save();
        return true;
    }
};

module.exports = userService;