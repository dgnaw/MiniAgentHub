const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/user');
const Role = require('../models/role');
const Permission = require('../models/permission');
const RolePermission = require('../models/rolePermission');
const { UserGroup, GroupPermission } = require('../models');
const { sendResetPasswordEmail } = require('../utils/emailService');
const AppError = require('../utils/AppError');

const loginUser = async (email, password) => {
    const user = await User.findOne({ where: { email } });
    if (!user) {
        throw new AppError('auth.invalidCredentials', 401);
    }

    if (!user.is_active) {
        throw new AppError('auth.accountLocked', 403);
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
        throw new AppError('auth.invalidCredentials', 401);
    }

    if (!process.env.JWT_SECRET) {
        console.error('Lỗi: JWT_SECRET chưa được cấu hình trong file .env');
        throw new AppError('server.configError', 500);
    }

    const role = await Role.findByPk(user.role_id);

    const payload = {
        id: user.id,
        email: user.email,
        role_id: user.role_id,
        role_name: role ? role.name : 'User'
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }); 
    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    const refreshToken = jwt.sign({ id: user.id }, refreshSecret, { expiresIn: '7d' });

    user.refresh_token = refreshToken;
    await user.save();


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
        refreshToken,
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



const refreshAccessToken = async (refreshToken) => {
    if (!refreshToken) {
        throw new AppError('auth.refreshTokenMissing', 401);
    }

    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    let decoded;
    try {
        decoded = jwt.verify(refreshToken, refreshSecret);
    } catch (err) {
        throw new AppError('auth.refreshTokenInvalid', 403);
    }

    const user = await User.findOne({ where: { id: decoded.id, refresh_token: refreshToken } });
    if (!user) {
        throw new AppError('auth.refreshTokenNotFound', 403);
    }

    if (!user.is_active) {
        throw new AppError('auth.accountLocked', 403);
    }

    const role = await Role.findByPk(user.role_id);
    const payload = {
        id: user.id,
        email: user.email,
        role_id: user.role_id,
        role_name: role ? role.name : 'User'
    };

    const newAccessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    return { token: newAccessToken };
};

const logoutUser = async (userId) => {
    if (!userId) return;
    const user = await User.findByPk(userId);
    if (user) {
        user.refresh_token = null;
        await user.save();
    }
    return { message: 'auth.logoutSuccess' };
};

const forgotPassword = async (email, lng = 'vi') => {
    const user = await User.findOne({ where: { email } });
    if (!user) {
        throw new AppError('auth.emailNotFound', 404);
    }

    if (!user.is_active) {
        throw new AppError('auth.accountLocked', 403);
    }

    const tempPassword = crypto.randomBytes(4).toString('hex');

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    user.password_hash = passwordHash;
    user.is_first_login = true;
    await user.save();

    await sendResetPasswordEmail(user.email, user.full_name, tempPassword, lng);

    return { message: 'auth.newPasswordSent' };
};

module.exports = {
    loginUser,
    refreshAccessToken,
    logoutUser,
    forgotPassword
};
