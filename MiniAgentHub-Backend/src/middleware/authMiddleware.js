const jwt = require('jsonwebtoken');
const { Permission, RolePermission } = require('../models');

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

            if (req.params.id && req.params.id === req.user.id && (requiredPermission === 'USER_R' || requiredPermission === 'USER_U')) {
                return next();
            }

            // TÍCH HỢP RBAC: Lấy quyền động từ Database
            const rolePerms = await RolePermission.findAll({
                where: { role_id: roleId }
            });
            
            const permissionIds = rolePerms.map(rp => rp.permission_id);
            const permissionsList = await Permission.findAll({ where: { id: permissionIds } });
            const userPermissions = permissionsList.map(p => p.permission_key);

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
