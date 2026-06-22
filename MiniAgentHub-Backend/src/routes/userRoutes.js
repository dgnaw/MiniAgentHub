const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const userController = require('../controllers/userController');

const { authenticateToken, checkPermission } = require('../middleware/authMiddleware');

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
    }
    next();
};

const createUserValidationRules = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email không được để trống.')
        .isEmail().withMessage('Email không đúng định dạng.'),
    body('full_name')
        .trim()
        .notEmpty().withMessage('Họ và tên không được để trống.')
];

const updateUserValidationRules = [
    body('email')
        .optional()
        .trim()
        .notEmpty().withMessage('Email không được để trống.')
        .isEmail().withMessage('Email không đúng định dạng.'),
    body('full_name')
        .optional()
        .trim()
        .notEmpty().withMessage('Họ và tên không được để trống.')
];

router.get('/users', authenticateToken, checkPermission('USER_R'), userController.getAllUsers);

router.post('/users', 
    authenticateToken, 
    checkPermission('USER_C'), 
    createUserValidationRules, 
    handleValidationErrors, 
    userController.createUser
);

router.put('/users/change-password', authenticateToken, userController.changePassword);

router.get('/users/:id', authenticateToken, checkPermission('USER_R'), userController.getUserById);

router.put('/users/:id', 
    authenticateToken, 
    checkPermission('USER_U'), 
    updateUserValidationRules, 
    handleValidationErrors, 
    userController.updateUser
);

router.delete('/users/:id', authenticateToken, checkPermission('USER_D'), userController.deleteUser);

module.exports = router;