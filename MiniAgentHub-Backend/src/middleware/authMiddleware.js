const jwt = require('jsonwebtoken');
const { Permission, RolePermission, UserGroup, GroupPermission } = require('../models');

const authenticateToken = (req, res, next) => {
    // Lấy header Authorization từ request
    const authHeader = req.headers['authorization'];
    
    // Header thường có định dạng "Bearer <token>", ta tách để lấy phần <token>
    const token = authHeader && authHeader.split(' ')[1];

    // Nếu không có token, trả về lỗi 401 Unauthorized
    if (!token) {
        return res.status(401).json({ message: 'Truy cập bị từ chối. Không tìm thấy Token xác thực.' });
    }

    try {
        // Giải mã token sử dụng JWT_SECRET
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Gán thông tin user (payload từ token bao gồm id, email, role, group_id) vào req.user
        req.user = decoded;
        
        // Cho phép request đi tiếp tới controller
        next();
    } catch (error) {
        // Nếu token sai, hết hạn hoặc không hợp lệ
        return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
    }
};

// Middleware kiểm tra quyền hạn (Authorization)
const checkPermission = (requiredPermission) => {
    return async (req, res, next) => {
        try {
            // req.user đã được gán từ hàm authenticateToken chạy trước đó
            const roleId = req.user.role_id; 

            // TÍCH HỢP RBAC: Lấy quyền động từ Database cho Role
            let rolePermissionIds = [];
            if (roleId) {
                const rolePerms = await RolePermission.findAll({
                    where: { role_id: roleId }
                });
                rolePermissionIds = rolePerms.map(rp => rp.permission_id);
            }
            
            // Lấy quyền từ các nhóm mà User đang tham gia
            const userGroups = await UserGroup.findAll({
                where: { user_id: req.user.id }
            });
            const groupIds = userGroups.map(ug => ug.group_id);
            
            let groupPermissionIds = [];
            if (groupIds.length > 0) {
                const groupPerms = await GroupPermission.findAll({ where: { group_id: groupIds } });
                groupPermissionIds = groupPerms.map(gp => gp.permission_id);
            }
            
            // Gộp tất cả các quyền của Role và Group (dùng Set để loại bỏ trùng lặp)
            const allPermissionIds = [...new Set([...rolePermissionIds, ...groupPermissionIds])];
            let userPermissions = [];
            
            if (allPermissionIds.length > 0) {
                const permissionsList = await Permission.findAll({ where: { id: allPermissionIds } });
                userPermissions = permissionsList.map(p => p.permission_key);
            }
            
            // Gắn mảng quyền vào req để Controller có thể dùng
            req.userPermissions = userPermissions;

            // So sánh kiểu chuỗi (String) vì req.params.id luôn là string, còn req.user.id có thể là number
            // Cho phép user tự xem/sửa profile của chính mình mà không cần quyền Admin
            if (req.params.id && String(req.params.id) === String(req.user.id) && (requiredPermission === 'USER_R' || requiredPermission === 'USER_U')) {
                return next();
            }

            // Kiểm tra xem mảng quyền của user này có chứa quyền yêu cầu không
            if (!userPermissions.includes(requiredPermission)) {
                return res.status(403).json({ 
                    message: 'Forbidden: Bạn không có quyền thực hiện hành động này.' 
                });
            }

            // Nếu có quyền thì cho đi tiếp
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
