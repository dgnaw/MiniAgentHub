const AppError = require('../utils/AppError');

const errorHandler = (err, req, res, next) => {
    // Nếu là lỗi AppError do mình tự ném ra
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            message: req.t(err.message, err.params),
        });
    }

    // Nếu là lỗi multer (upload file)
    if (err.name === 'MulterError') {
        return res.status(400).json({
            message: err.message
        });
    }

    // Các lỗi không lường trước (Lỗi hệ thống)
    console.error('Unhandled Error:', err);
    
    // Nếu có req.t thì dịch lỗi mặc định, không thì trả về tiếng Anh
    const message = req.t ? req.t('server.internalError') : 'Internal server error';

    return res.status(500).json({
        message: message,
    });
};

module.exports = errorHandler;
