const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Role = require('../models/role');
const Permission = require('../models/permission');
const RolePermission = require('../models/rolePermission');
const { UserGroup, GroupPermission } = require('../models');

const loginUser = async (email, password) => {
    const user = await User.findOne({ where: { email } });
    if (!user) {
        const error = new Error('Email hoặc mật khẩu không chính xác');
        error.statusCode = 401;
        throw error;
    }

    if (!user.is_active) {
        const error = new Error('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên.');
        error.statusCode = 403; 
        throw error;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
        const error = new Error('Email hoặc mật khẩu không chính xác');
        error.statusCode = 401;
        throw error;
    }

    if (!process.env.JWT_SECRET) {
        console.error('Lỗi: JWT_SECRET chưa được cấu hình trong file .env');
        const error = new Error('Lỗi cấu hình server');
        error.statusCode = 500;
        throw error;
    }

    const payload = {
        id: user.id,
        email: user.email,
        role_id: user.role_id,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' }); 

    const role = await Role.findByPk(user.role_id);

    const rolePerms = await RolePermission.findAll({
        where: { role_id: user.role_id }
    });

    const rolePermissionIds = rolePerms.map(rp => rp.permission_id);
    
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
    const permissionsList = await Permission.findAll({ where: { id: allPermissionIds } });
    const permissions = permissionsList.map(p => p.permission_key);

    return {
        token,
        user: {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            phone: user.phone,
            address: user.address,
            role: role ? role.name : 'User',
            role_id: user.role_id
        },
        permissions,
        must_change_password: user.is_first_login
    };
};

module.exports = {
    loginUser
};
