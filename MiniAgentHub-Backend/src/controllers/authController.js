const authService = require('../services/authService');

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const result = await authService.loginUser(email, password);

        return res.status(200).json({
            message: req.t('auth.loginSuccess'),
            token: result.token,
            refreshToken: result.refreshToken,
            user: result.user,
            permissions: result.permissions,
            must_change_password: result.must_change_password
        });

    } catch (error) {
        next(error);
    }
};

const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: req.t('validation.emailRequired') });
        }

        const result = await authService.forgotPassword(email, req.language);
        return res.status(200).json({ message: req.t(result.message) });

    } catch (error) {
        next(error);
    }
};

const refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ message: req.t('auth.refreshTokenMissing') });
        }
        
        const result = await authService.refreshAccessToken(refreshToken);
        return res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

const logout = async (req, res, next) => {
    try {
        const userId = req.user.id; // Lấy từ authMiddleware
        const result = await authService.logoutUser(userId);
        return res.status(200).json({ message: req.t(result.message) });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    login,
    refreshToken,
    logout,
    forgotPassword
};
