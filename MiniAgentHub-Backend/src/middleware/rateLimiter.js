const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default; 
const redisClient = require('../config/redis');

const authLimiter = rateLimit({
    store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
    }),
    windowMs: 15 * 60 * 1000, 
    max: 15,
    handler: (req, res, next, options) => {
        res.status(options.statusCode).json({ message: req.t('rateLimit.auth') });
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const chatLimiter = rateLimit({
    store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
    }),
    windowMs: 60 * 1000, 
    max: 30, 
    handler: (req, res, next, options) => {
        res.status(options.statusCode).json({ message: req.t('rateLimit.chat') });
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    authLimiter,
    chatLimiter
};
