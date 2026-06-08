const jwt = require('jsonwebtoken');
const { Permission, RolePermission, UserGroup, GroupPermission } = require('../models');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Truy cập bị từ chối. Không tìm thấy Token xác thực.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        req.user = decoded;
        
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
    }
};

const checkPermission = (requiredPermission) => {
    return async (req, res, next) => {
        try {
            // Bypass cho Admin: Mặc định Admin có toàn quyền, không cần tra cứu Permission
            if (req.user.role === 'Admin' || req.user.role_name === 'Admin' || req.user.role_id === 1) {
                return next();
            }

            const roleId = req.user.role_id; 

            let rolePermissionIds = [];
            if (roleId) {
                const rolePerms = await RolePermission.findAll({
                    where: { role_id: roleId }
                });
                rolePermissionIds = rolePerms.map(rp => rp.permission_id);
            }
            
            const userGroups = await UserGroup.findAll({
                where: { user_id: req.user.id }
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
            
            req.userPermissions = userPermissions;

            if (req.params.id && String(req.params.id) === String(req.user.id) && (requiredPermission === 'USER_R' || requiredPermission === 'USER_U')) {
                return next();
            }

            if (!userPermissions.includes(requiredPermission)) {
                return res.status(403).json({ 
                    message: 'Forbidden: Bạn không có quyền thực hiện hành động này.' 
                });
            }

            next();
        } catch (error) {
            console.error('Lỗi kiểm tra quyền:', error);
            return res.status(500).json({ message: 'Lỗi server khi xác thực quyền.' });
        }
    };
};

module.exports = {
    authenticateToken,
    checkPermission 
};
