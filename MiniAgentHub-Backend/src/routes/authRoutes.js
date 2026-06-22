const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
    }
    next();
};

router.post('/login', [
    body('email')
        .trim()
        .notEmpty().withMessage('Email không được để trống.')
        .isEmail().withMessage('Email không đúng định dạng.'),
    body('password')
        .notEmpty().withMessage('Mật khẩu không được để trống.')
        .isLength({ min: 6 }).withMessage('Mật khẩu phải chứa ít nhất 6 ký tự.')
], handleValidationErrors, authController.login);

module.exports = router;