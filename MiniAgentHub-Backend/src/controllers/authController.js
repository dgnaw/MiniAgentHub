const authService = require('../services/authService');
const catchAsync = require('../utils/catchAsync');

const login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    const result = await authService.loginUser(email, password);

    const isProd = process.env.NODE_ENV === 'production';
    const cookieOptions = {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 
    };

    res.cookie('agentHub_token', result.token, cookieOptions);
    if (result.refreshToken) {
        res.cookie('agentHub_refreshToken', result.refreshToken, cookieOptions);
    }

    return res.status(200).json({
        message: req.t('auth.loginSuccess'),
        user: result.user,
        permissions: result.permissions,
        must_change_password: result.must_change_password
    });
});

const forgotPassword = catchAsync(async (req, res, next) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: req.t('validation.emailRequired') });
    }

    const result = await authService.forgotPassword(email, req.language);
    return res.status(200).json({ message: req.t(result.message) });
});

const refreshToken = catchAsync(async (req, res, next) => {
    const refreshToken = req.cookies?.agentHub_refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ message: req.t('auth.refreshTokenMissing') });
    }
    
    const result = await authService.refreshAccessToken(refreshToken);

    const isProd = process.env.NODE_ENV === 'production';
    const cookieOptions = {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
    };

    res.cookie('agentHub_token', result.token, cookieOptions);

    return res.status(200).json({ message: 'Token refreshed successfully' });
});

const logout = catchAsync(async (req, res, next) => {
    const userId = req.user.id; 
    const result = await authService.logoutUser(userId);
    
    res.clearCookie('agentHub_token');
    res.clearCookie('agentHub_refreshToken');

    return res.status(200).json({ message: req.t(result.message) });
});

module.exports = {
    login,
    refreshToken,
    logout,
    forgotPassword
};
