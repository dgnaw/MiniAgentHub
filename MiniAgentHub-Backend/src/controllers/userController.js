const userService = require('../services/userService');

const userController = {
    createUser: async (req, res) => {
        try {
            let { email, full_name, phone, address, role_id, role_name, role, group_ids } = req.body;
            
            email = email?.trim();
            full_name = full_name?.trim();

            if (!email || !full_name) {
                return res.status(400).json({ message: 'Email và Tên không được để trống' });
            }

            const targetRoleName = role_name || role;

            const result = await userService.createUser({ email, full_name, phone, address, role_id, role_name: targetRoleName, group_ids });
            
            if (result.error) {
                return res.status(result.status || 400).json({ message: result.error });
            }
            
            if (!result.emailSent) {
                return res.status(201).json({
                    message: 'Tạo tài khoản thành công nhưng gửi email lỗi. Vui lòng cấp pass tay.',
                    user: result.user,
                    temporary_password: result.rawPassword
                });
            }
            
            return res.status(201).json({
                message: 'Tạo tài khoản thành công.',
                user: result.user
            });
            
        } catch (error) {
            console.error('Lỗi tại userController.createUser:', error);
            const status = error.status || 500;
            return res.status(status).json({ message: error.message || 'Lỗi server nội bộ' });
        }
    },

    getAllUsers: async (req, res) => {
        try {
            const users = await userService.getAllUsers();
            return res.status(200).json(users);
        } catch (error) {
            console.error('Lỗi tại userController.getAllUsers:', error);
            return res.status(500).json({ message: 'Lỗi server khi tải danh sách người dùng.' });
        }
    },

    getUserById: async (req, res) => {
        try {
            const result = await userService.getUserById(req.params.id);
            if (result.error) {
                return res.status(result.status || 404).json({ message: result.error });
            }
            return res.status(result.status || 200).json(result.data);
        } catch (error) {
            console.error('Lỗi tại userController.getUserById:', error);
            return res.status(500).json({ message: 'Lỗi server nội bộ' });
        }
    },

    updateUser: async (req, res) => {
        try {
            const result = await userService.updateUser(req.params.id, req.body);
            if (result.error) {
                return res.status(result.status || 400).json({ message: result.error });
            }
            return res.status(result.status || 200).json(result.data);
        } catch (error) {
            console.error('Lỗi tại userController.updateUser:', error);
            return res.status(500).json({ message: 'Lỗi server nội bộ' });
        }
    },

    deleteUser: async (req, res) => {
        try {
            const result = await userService.deleteUser(req.params.id);
            if (result.error) {
                return res.status(result.status || 400).json({ message: result.error });
            }
            return res.status(result.status || 200).json(result.data);
        } catch (error) {
            console.error('Lỗi tại userController.deleteUser:', error);
            return res.status(500).json({ message: 'Lỗi server nội bộ' });
        }
    },

    changePassword: async (req, res) => {
        try {
            const { new_password } = req.body;

            const userId = req.user.id;

            // Ép kiểu về String để tránh lỗi sập server nếu Frontend gửi lên kiểu số nguyên
            if (!new_password || String(new_password).trim().length < 6) {
                return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
            }

            await userService.changePassword(userId, new_password);

            return res.status(200).json({ message: 'Đổi mật khẩu thành công! Tài khoản của bạn đã được kích hoạt' });
        } catch (error) {
            console.error('Lỗi tại changePassword Controller:', error);
            const status = error.status || 500;
            return res.status(status).json({ message: error.message || 'Lỗi server nội bộ' });
        }
    }

};

module.exports = userController;