const userService = require('../services/userService');
const catchAsync = require('../utils/catchAsync');

const userController = {
    createUser: catchAsync(async (req, res, next) => {
        let { email, full_name, phone, address, role_id, role_name, role, group_ids } = req.body;

        const targetRoleName = role_name || role;

        const result = await userService.createUser({ email, full_name, phone, address, role_id, role_name: targetRoleName, group_ids }, req.language);

        return res.status(201).json({
            message: req.t('user.createSuccess'),
            user: result.user
        });
    }),

    getAllUsers: catchAsync(async (req, res, next) => {
        const users = await userService.getAllUsers();
        return res.status(200).json(users);
    }),

    getUserById: catchAsync(async (req, res, next) => {
        const result = await userService.getUserById(req.params.id);
        return res.status(result.status || 200).json(result.data);
    }),

    updateUser: catchAsync(async (req, res, next) => {
        const updateData = { ...req.body };

        if (!req.userPermissions?.includes('USER_U')) {
            delete updateData.role_id;
            delete updateData.role_name;
            delete updateData.role;
            delete updateData.group_ids;
        }

        const result = await userService.updateUser(req.params.id, updateData);
        return res.status(result.status || 200).json(result.data);
    }),

    deleteUser: catchAsync(async (req, res, next) => {
        const result = await userService.deleteUser(req.params.id);
        return res.status(result.status || 200).json({ message: req.t(result.data.message) });
    }),

    changePassword: catchAsync(async (req, res, next) => {
        const { old_password, new_password } = req.body;

        const userId = req.user.id;

        if (!old_password || String(old_password).trim().length === 0) {
            return res.status(400).json({ message: req.t('auth.oldPasswordRequired') });
        }

        if (!new_password || String(new_password).trim().length < 6) {
            return res.status(400).json({ message: req.t('auth.passwordTooShort') });
        }

        await userService.changePassword(userId, old_password, new_password);

        return res.status(200).json({ message: req.t('auth.changePasswordSuccess') });
    })
};

module.exports = userController;