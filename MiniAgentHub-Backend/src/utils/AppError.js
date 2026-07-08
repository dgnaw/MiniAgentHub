class AppError extends Error {
    constructor(messageKey, errorCode = 'INTERNAL_ERROR', params = {}) {
        super(messageKey);
        this.errorCode = errorCode;
        this.params = params;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;
