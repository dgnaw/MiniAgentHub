const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/user');
const Role = require('../models/role');
const Permission = require('../models/permission');
const RolePermission = require('../models/rolePermission');
const { UserGroup, GroupPermission } = require('../models');
const { sendResetPasswordEmail } = require('../utils/emailService');

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

    const role = await Role.findByPk(user.role_id);

    const payload = {
        id: user.id,
        email: user.email,
        role_id: user.role_id,
        role_name: role ? role.name : 'User'
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' }); 


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



const forgotPassword = async (email) => {
    const user = await User.findOne({ where: { email } });
    if (!user) {
        const error = new Error('Tài khoản với email này không tồn tại.');
        error.statusCode = 404;
        throw error;
    }

    if (!user.is_active) {
        const error = new Error('Tài khoản của bạn đã bị khóa.');
        error.statusCode = 403;
        throw error;
    }

    const tempPassword = crypto.randomBytes(4).toString('hex');

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    user.password_hash = passwordHash;
    user.is_first_login = true;
    await user.save();

    await sendResetPasswordEmail(user.email, user.full_name, tempPassword);

    return { message: 'Mật khẩu mới đã được gửi tới email của bạn.' };
};

module.exports = {
    loginUser,
    forgotPassword
};
