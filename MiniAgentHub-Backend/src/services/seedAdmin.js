const bcrypt = require('bcrypt');
const { User, Role, Permission, RolePermission } = require('../models');

async function seedAdmin() {
    try {
        console.log('Đang kiểm tra và khởi tạo dữ liệu mặc định...');

        const [adminRole] = await Role.findOrCreate({
            where: { name: 'Admin' },
            defaults: { description: 'Quản trị viên toàn quyền hệ thống' }
        });

        await Role.findOrCreate({
            where: { name: 'User' },
            defaults: { description: 'Người dùng tiêu chuẩn' }
        });

        // Khởi tạo các quyền cơ bản
        const basicPermissions = [
            { permission_key: 'USER_C', description: 'Tạo User' },
            { permission_key: 'USER_R', description: 'Xem User' },
            { permission_key: 'USER_U', description: 'Sửa User' },
            { permission_key: 'USER_D', description: 'Xóa User' },
            { permission_key: 'GROUP_C', description: 'Tạo Group' },
            { permission_key: 'GROUP_R', description: 'Xem Group' },
            { permission_key: 'GROUP_U', description: 'Sửa Group' },
            { permission_key: 'GROUP_D', description: 'Xóa Group' },
            { permission_key: 'CHAT', description: 'Quyền sử dụng Chat AI' }
        ];

        for (const perm of basicPermissions) {
            const [permission] = await Permission.findOrCreate({
                where: { permission_key: perm.permission_key },
                defaults: perm
            });
            
            await RolePermission.findOrCreate({
                where: { role_id: adminRole.id, permission_id: permission.id }
            });
        }

        const adminEmail = 'admin@agenthub.com';
        const adminExist = await User.findOne({ where: { email: adminEmail } });

        if (!adminExist) {
            const password_hash = await bcrypt.hash('Admin@123', 10);
            
            await User.create({
                email: adminEmail,
                full_name: 'System Admin',
                password_hash: password_hash,
                role_id: adminRole.id,
                is_active: true
            });
            console.log('Đã tạo tài khoản Admin thành công:');
            console.log('   - Email: admin@agenthub.com');
            console.log('   - Mật khẩu: Admin@123');
        } else {
            console.log('Tài khoản Admin đã tồn tại, bỏ qua bước khởi tạo.');
        }
    } catch (error) {
        console.error('Lỗi khi khởi tạo dữ liệu:', error);
    }
}

seedAdmin();