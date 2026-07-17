const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const AppError = require('../utils/AppError');

const { User, Role, Group, Permission } = require('../models');
const cacheHelper = require('../utils/cacheHelper');
const { emailQueue } = require('../config/queue');

const loginUser = async (email, password) => {
    const user = await User.findOne({ 
        where: { email },
        include: [{ model: Role, as: 'Role'}] 
    });

    if (!user) {
        throw new AppError('auth.invalidCredentials', 'UNAUTHORIZED');
    }

    if (!user.is_active) {
        throw new AppError('auth.accountLocked', 'FORBIDDEN');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
        throw new AppError('auth.invalidCredentials', 'UNAUTHORIZED');
    }

    if (!process.env.JWT_SECRET) {
        console.error('Lỗi: JWT_SECRET chưa được cấu hình trong file .env');
        throw new AppError('server.configError', 'INTERNAL_ERROR');
    }

    const roleName = user?.Role.name || 'User';

    const payload = {
        id: user.id,
        email: user.email,
        role_id: user.role_id,
        role_name: roleName
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }); 
    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    const refreshToken = jwt.sign({ id: user.id }, refreshSecret, { expiresIn: '7d' });

    const salt = await bcrypt.genSalt(10);
    user.refresh_token = await bcrypt.hash(refreshToken, salt);
    
    const [rolewithPerms, userWithGroups] = await Promise.all([
        Role.findByPk(user.role_id, {
            include: [{model: Permission}]
        }),
        User.findByPk(user.id, {
            include: [{
                model: Group,
                include: [{model: Permission}]
            }]
        }),
        user.save()
    ]);
    
    const rolePermissions = rolewithPerms?.Permissions?.map(p => p.permission_key) || [];
    const groupPermissions = userWithGroups?.Groups?.flatMap(g => g.Permissions?.map(p => p.permission_key) || []) || [];
    const permissions = [...new Set([...rolePermissions, ...groupPermissions])];

    return {
        token,
        refreshToken,
        user: {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            phone: user.phone,
            address: user.address,
            role: roleName,
            role_id: user.role_id
        },
        permissions,
        must_change_password: user.is_first_login
    };
};

const refreshAccessToken = async (refreshToken) => {
    if (!refreshToken) {
        throw new AppError('auth.refreshTokenMissing', 'UNAUTHORIZED');
    }

    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    let decoded;
    try {
        decoded = jwt.verify(refreshToken, refreshSecret);
    } catch (err) {
        throw new AppError('auth.refreshTokenInvalid', 'FORBIDDEN');
    }

    const user = await User.findOne({
        where: { id: decoded.id },
        include: [{ model: Role }]
    });

    if (!user || !user.refresh_token) {
        throw new AppError('auth.refreshTokenNotFound', 'FORBIDDEN');
    }

    const isMatch = await bcrypt.compare(refreshToken, user.refresh_token);
    if (!isMatch) {
        throw new AppError('auth.refreshTokenInvalid', 'FORBIDDEN');
    }

    if (!user.is_active) {
        throw new AppError('auth.accountLocked', 'FORBIDDEN');
    }

    const payload = {
        id: user.id,
        email: user.email,
        role_id: user.role_id,
        role_name: user.Role ? user.Role.name : 'User'
    };

    const newAccessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    return { token: newAccessToken };
};

const logoutUser = async (userId, token) => {
    if (!userId) return;

    if (token) {
        try {
            const decoded = jwt.decode(token);
            if (decoded && decoded.exp) {
                const currentTime = Math.floor(Date.now() / 1000);
                const ttl = decoded.exp - currentTime;
                if (ttl > 0) {
                    await cacheHelper.setex(`bl:${token}`, ttl, 'true');
                }
            }
        } catch (error) {
            console.error('Lỗi khi thêm token vào blacklist:', error);
        }
    }

    await User.update({refresh_token: null}, {where: {id: userId}});
    return { message: 'auth.logoutSuccess' };
};

const forgotPassword = async (email, lng = 'vi') => {
    const user = await User.findOne({ where: { email } });
    
    if (user && user.is_active) {
        const tempPassword = crypto.randomBytes(16).toString('hex');

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(tempPassword, salt);

        user.password_hash = passwordHash;
        user.is_first_login = true;
        await user.save();

        try {
            await emailQueue.add('resetPasswordEmail', { 
                email: user.email, 
                full_name: user.full_name, 
                password: tempPassword, 
                lng 
            });
        } catch (mailError) {
            console.error('Lỗi khi đưa email reset password vào hàng đợi:', mailError);
        }
    }

    return { message: 'auth.newPasswordSent' };
};

module.exports = {
    loginUser,
    refreshAccessToken,
    logoutUser,
    forgotPassword
};
