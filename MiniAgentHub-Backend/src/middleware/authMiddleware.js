const jwt = require('jsonwebtoken');
const { Permission, RolePermission, UserGroup, GroupPermission, User } = require('../models');
const AppError = require('../utils/AppError');
const cacheHelper = require('../utils/cacheHelper');

const authenticateToken = async (req, res, next) => {
    const publicPaths = ['/login', '/forgot-password', '/refresh-token'];
    const isPublic = publicPaths.some(p => req.path.endsWith(p)) || req.path.includes('/public/');
    
    if (isPublic) {
        return next();
    }

    const token = req.cookies?.agentHub_token;

    if (!token) {
        return next(new AppError('auth.tokenNotFound', 'UNAUTHORIZED'));
    }

    try {
        const isBlacklisted = await cacheHelper.get(`bl:${token}`);
        if (isBlacklisted) {
            return next(new AppError('auth.tokenInvalid', 'UNAUTHORIZED'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findByPk(decoded.id, {
            attributes: ['id', 'is_active', 'role_id']
        });

        if (!user) {
            return next(new AppError('auth.userNotFound', 'UNAUTHORIZED'));
        }

        if (!user.is_active) {
            return next(new AppError('auth.accountInactive', 'FORBIDDEN'));
        }

        req.user = {
            ...decoded,
            role_id: user.role_id,
            is_active: user.is_active
        };

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return next(new AppError('auth.tokenInvalid', 'UNAUTHORIZED'));
        }
        console.error('Lỗi xác thực token:', error);
        return next(error);
    }
};

const checkPermission = (requiredPermission) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return next(new AppError('auth.unauthenticated', 'UNAUTHORIZED'));
            }

            const redisKey = `user:${req.user.id}:permissions`;
            let userPermissions = [];
            const cachedPerms = await cacheHelper.get(redisKey);

            if (cachedPerms) {
                userPermissions = JSON.parse(cachedPerms);
            } else {
                const roleId = req.user.role_id;

                const [rolePerms, userGroups] = await Promise.all([
                    roleId ? RolePermission.findAll({
                        attributes: ['permission_id'],
                        where: { role_id: roleId }
                    }) : Promise.resolve([]),
                    UserGroup.findAll({
                        attributes: ['group_id'],
                        where: { user_id: req.user.id }
                    })
                ]);

                const rolePermissionIds = rolePerms.map(rp => rp.permission_id);
                const groupIds = userGroups.map(ug => ug.group_id);

                let groupPermissionIds = [];
                if (groupIds.length > 0) {
                    const groupPerms = await GroupPermission.findAll({
                        attributes: ['permission_id'],
                        where: { group_id: groupIds }
                    });
                    groupPermissionIds = groupPerms.map(gp => gp.permission_id);
                }

                const allPermissionIds = [...new Set([...rolePermissionIds, ...groupPermissionIds])];

                if (allPermissionIds.length > 0) {
                    const permissionsList = await Permission.findAll({
                        attributes: ['permission_key'],
                        where: { id: allPermissionIds }
                    });
                    userPermissions = permissionsList.map(p => p.permission_key);
                }

                await cacheHelper.setex(redisKey, 3600, JSON.stringify(userPermissions));
            }

            req.userPermissions = userPermissions;

            if (req.params.id && String(req.params.id) === String(req.user.id) && (requiredPermission === 'USER_R' || requiredPermission === 'USER_U')) {
                return next();
            }

            if (!userPermissions.includes(requiredPermission)) {
                return next(new AppError('auth.forbidden', 'FORBIDDEN'));
            }

            next();
        } catch (error) {
            console.error('Lỗi kiểm tra quyền:', error);
            return next(new AppError('server.initError', 'INTERNAL_ERROR'));
        }
    };
};

module.exports = {
    authenticateToken,
    checkPermission
};
