const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default; 
const redisClient = require('../config/redis');

const isRedisEnabled = process.env.USE_REDIS !== 'false';

const getStore = (prefix) => {
    return isRedisEnabled ? new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix: prefix
    }) : undefined;
};

const authLimiter = rateLimit({
    store: getStore('rl_auth:'),
    windowMs: 5 * 60 * 1000, 
    max: 5,
    handler: (req, res, next, options) => {
        res.status(options.statusCode).json({ message: req.t('rateLimit.auth') });
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const chatLimiter = rateLimit({
    store: getStore('rl_chat:'),
    windowMs: 60 * 1000, 
    max: 20, 
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
