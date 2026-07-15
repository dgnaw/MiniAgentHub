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
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 1000; // Mặc định 1000 để tạm tương thích nếu frontend chưa truyền limit
        const result = await userService.getAllUsers(page, limit);
        return res.status(200).json({
            data: result.rows,
            pagination: {
                total: result.count,
                page,
                limit,
                totalPages: Math.ceil(result.count / limit)
            }
        });
    }),

    getUserById: catchAsync(async (req, res, next) => {
        const result = await userService.getUserById(req.params.id);
        return res.status(200).json(result);
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
        return res.status(200).json(result);
    }),

    deleteUser: catchAsync(async (req, res, next) => {
        const force = req.query.force === 'true';
        const result = await userService.deleteUser(req.params.id, force);
        return res.status(200).json({ message: req.t(result.message) });
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