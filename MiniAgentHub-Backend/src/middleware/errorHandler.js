const AppError = require('../utils/AppError');

 const HTTP_STATUS_MAP = {
    'BAD_REQUEST': 400,
    'UNAUTHORIZED': 401,
    'FORBIDDEN': 403,
    'NOT_FOUND': 404,
    'CONFLICT': 409,
    'VALIDATION_ERROR': 422,
    'INTERNAL_ERROR': 500
};

const errorHandler = (err, req, res, next) => {
    if (err instanceof AppError) {
       const statusCode = HTTP_STATUS_MAP[err.errorCode] || 500;
        return res.status(statusCode).json({
            message: req.t(err.message, err.params),
        });
    }

    if (err.name === 'MulterError') {
        return res.status(400).json({
            message: err.message
        });
    }

    console.error('Unhandled Error:', err);
    
    const message = req.t ? req.t('server.internalError') : 'Internal server error';

    return res.status(500).json({
        message: message,
    });
};

module.exports = errorHandler;
