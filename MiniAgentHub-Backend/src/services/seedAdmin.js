require('dotenv').config();
const bcrypt = require('bcrypt');
const { User, Role, Permission, RolePermission, Group, UserGroup, GroupPermission } = require('../models');

async function seedAdmin() {
    try {
        console.log('Checking and initializing default data...');

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

        const [adminGroup] = await Group.findOrCreate({
            where: { name: 'Admin Group' },
            defaults: { description: 'Nhóm dành cho Quản trị viên hệ thống' }
        });

        const [userGroup] = await Group.findOrCreate({
            where: { name: 'User Group' },
            defaults: { description: 'Nhóm dành cho Người dùng tiêu chuẩn' }
        });

        const adminPerms = await Permission.findAll();
        for (const perm of adminPerms) {
            await GroupPermission.findOrCreate({ where: { group_id: adminGroup.id, permission_id: perm.id } });
        }

        const userPerms = await Permission.findAll({ where: { permission_key: ['USER_R', 'CHAT'] } });
        for (const perm of userPerms) {
            await GroupPermission.findOrCreate({ where: { group_id: userGroup.id, permission_id: perm.id } });
        }

        const adminEmail = process.env.DEFAULT_ADMIN_EMAIL;
        const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;
        const adminExist = await User.findOne({ where: { email: adminEmail } });

        if (!adminExist) {
            const password_hash = await bcrypt.hash(adminPassword, 10);
            
            const newAdmin = await User.create({
                email: adminEmail,
                full_name: 'System Admin',
                password_hash: password_hash,
                role_id: adminRole.id,
                is_active: true
            });

            await UserGroup.findOrCreate({
                where: { user_id: newAdmin.id, group_id: adminGroup.id }
            });

            console.log('Admin account created successfully:');
            console.log(`   - Email: ${adminEmail}`);
            console.log(`   - Password: ${adminPassword}`);
        } else {
            console.log('Admin account already exists, skipping initialization.');
            
            await UserGroup.findOrCreate({
                where: { user_id: adminExist.id, group_id: adminGroup.id }
            });
        }
    } catch (error) {
        console.error('Error initializing data:', error);
    }
}

seedAdmin().then(() => {
    console.log('Initialization process completed.');
    process.exit(0);
}).catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
});