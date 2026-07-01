const userService = require('../services/userService');

const userController = {
    createUser: async (req, res, next) => {
        try {
            let { email, full_name, phone, address, role_id, role_name, role, group_ids } = req.body;

            const targetRoleName = role_name || role;

            const result = await userService.createUser({ email, full_name, phone, address, role_id, role_name: targetRoleName, group_ids }, req.language);

            return res.status(201).json({
                message: req.t('user.createSuccess'),
                user: result.user
            });

        } catch (error) {
            next(error);
        }
    },

    getAllUsers: async (req, res, next) => {
        try {
            const users = await userService.getAllUsers();
            return res.status(200).json(users);
        } catch (error) {
            next(error);
        }
    },

    getUserById: async (req, res, next) => {
        try {
            const result = await userService.getUserById(req.params.id);
            return res.status(result.status || 200).json(result.data);
        } catch (error) {
            next(error);
        }
    },

    updateUser: async (req, res, next) => {
        try {
            const updateData = { ...req.body };

            // Bảo mật: Nếu người dùng không có quyền USER_U thực sự (chỉ đang tự update profile cá nhân nhờ bypass của middleware)
            // Tuyệt đối không cho phép đổi Role (Vai trò) và Group (Nhóm)
            if (!req.userPermissions?.includes('USER_U')) {
                delete updateData.role_id;
                delete updateData.role_name;
                delete updateData.role;
                delete updateData.group_ids;
            }

            const result = await userService.updateUser(req.params.id, updateData);
            return res.status(result.status || 200).json(result.data);
        } catch (error) {
            next(error);
        }
    },

    deleteUser: async (req, res, next) => {
        try {
            const result = await userService.deleteUser(req.params.id);
            return res.status(result.status || 200).json({ message: req.t(result.data.message) });
        } catch (error) {
            next(error);
        }
    },

    changePassword: async (req, res, next) => {
        try {
            const { old_password, new_password } = req.body;

            const userId = req.user.id;

            if (!old_password || String(old_password).trim().length === 0) {
                return res.status(400).json({ message: req.t('auth.oldPasswordRequired') });
            }

            // Ép kiểu về String để tránh lỗi sập server nếu Frontend gửi lên kiểu số nguyên
            if (!new_password || String(new_password).trim().length < 6) {
                return res.status(400).json({ message: req.t('auth.passwordTooShort') });
            }

            await userService.changePassword(userId, old_password, new_password);

            return res.status(200).json({ message: req.t('auth.changePasswordSuccess') });
        } catch (error) {
            next(error);
        }
    }

};

module.exports = userController;