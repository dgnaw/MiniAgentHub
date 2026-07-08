const jwt = require('jsonwebtoken');
const { Permission, RolePermission, UserGroup, GroupPermission, User } = require('../models');
const AppError = require('../utils/AppError');

const authenticateToken = async (req, res, next) => {
    // whitelist some public paths
    const publicPaths = ['/api/login', '/api/forgot-password', '/api/refresh-token'];
    if (publicPaths.includes(req.path) || req.path.startsWith('/api/public/')) {
        return next();
    }

    const token = req.cookies?.agentHub_token;

    if (!token) {
        return next(new AppError('auth.tokenNotFound', 'UNAUTHORIZED'));
    }

    try {
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
            let userPermissions = [];
            
            if (allPermissionIds.length > 0) {
                const permissionsList = await Permission.findAll({ 
                    attributes: ['permission_key'],
                    where: { id: allPermissionIds } 
                });
                userPermissions = permissionsList.map(p => p.permission_key);
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
