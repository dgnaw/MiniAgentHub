class AppError extends Error {
    constructor(messageKey, statusCode, params = {}) {
        super(messageKey);
        this.statusCode = statusCode;
        this.params = params;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;
