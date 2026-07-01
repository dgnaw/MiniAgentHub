const jwt = require('jsonwebtoken');
const { Permission, RolePermission, UserGroup, GroupPermission } = require('../models');

const authenticateToken = (req, res, next) => {
    // whitelist some public paths
    const publicPaths = ['/api/login', '/api/forgot-password', '/api/refresh-token'];
    if (publicPaths.includes(req.path)) {
        return next();
    }

    const authHeader = req.headers['authorization'];
    
    let token;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ message: req.t('auth.tokenNotFound') });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        req.user = decoded;
        
        next();
    } catch (error) {
        return res.status(401).json({ message: req.t('auth.tokenInvalid') });
    }
};

const checkPermission = (requiredPermission) => {
    return async (req, res, next) => {
        try {
            // Safety check: Đảm bảo req.user tồn tại (tránh lỗi crash trên các route public vô tình gọi checkPermission)
            if (!req.user) {
                return res.status(401).json({ message: req.t('auth.unauthenticated') });
            }

            const roleId = req.user.role_id; 

            // Chạy song song truy vấn RolePermission và UserGroup để tối ưu hiệu suất
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
                return res.status(403).json({ 
                    message: req.t('auth.forbidden') 
                });
            }

            next();
        } catch (error) {
            console.error('Lỗi kiểm tra quyền:', error);
            return res.status(500).json({ message: req.t('server.initError') });
        }
    };
};

module.exports = {
    authenticateToken,
    checkPermission 
};
