const authService = require('../services/authService');

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const result = await authService.loginUser(email, password);

        return res.status(200).json({
            message: 'Đăng nhập thành công',
            token: result.token,
            user: result.user,
            permissions: result.permissions,
            must_change_password: result.must_change_password
        });

    } catch (error) {
        console.error('Lỗi API Login:', error);
        const statusCode = error.statusCode || 500;
        const message = statusCode === 500 ? 'Lỗi server nội bộ' : error.message;
        return res.status(statusCode).json({ message });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Vui lòng cung cấp email.' });
        }

        const result = await authService.forgotPassword(email);
        return res.status(200).json(result);

    } catch (error) {
        console.error('Lỗi API Forgot Password:', error);
        const statusCode = error.statusCode || 500;
        const message = statusCode === 500 ? 'Lỗi server nội bộ' : error.message;
        return res.status(statusCode).json({ message });
    }
};

module.exports = {
    login,
    forgotPassword
};
