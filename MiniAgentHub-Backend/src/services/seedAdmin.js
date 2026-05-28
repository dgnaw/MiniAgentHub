const bcrypt = require('bcrypt');
const { User, Role } = require('../models');

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