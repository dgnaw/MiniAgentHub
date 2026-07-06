const AppError = require('../utils/AppError');

const errorHandler = (err, req, res, next) => {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
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
