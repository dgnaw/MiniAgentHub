const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default; // Important: .default for rate-limit-redis v4+ with CommonJS
const redisClient = require('../config/redis');

// Limiter for Auth Routes (Login)
const authLimiter = rateLimit({
    store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
    }),
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 15, // Tối đa 15 lần đăng nhập
    message: { message: "Bạn đã thao tác quá nhiều lần, vui lòng thử lại sau 15 phút." },
    standardHeaders: true,
    legacyHeaders: false,
});

// Limiter for AI Chat
const chatLimiter = rateLimit({
    store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
    }),
    windowMs: 60 * 1000, // 1 phút
    max: 30, // Tối đa 30 tin nhắn mỗi phút
    message: { message: "Bạn nhắn tin quá nhanh, vui lòng chờ một lát." },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    authLimiter,
    chatLimiter
};
