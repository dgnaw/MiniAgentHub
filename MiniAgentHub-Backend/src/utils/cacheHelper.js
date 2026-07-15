const redisClient = require('../config/redis');

let isRedisConnected = false;

redisClient.on('connect', () => {
    isRedisConnected = true;
});

redisClient.on('error', () => {
    isRedisConnected = false;
});

const isRedisEnabled = process.env.USE_REDIS !== 'false';

const cacheHelper = {
    get: async (key) => {
        if (!isRedisEnabled || !isRedisConnected) return null;
        try {
            return await redisClient.get(key);
        } catch (error) {
            console.warn(`[CacheHelper] Lỗi khi lấy cache cho key ${key}:`, error.message);
            return null;    
        }
    },

    setex: async (key, ttl, value) => {
        if (!isRedisEnabled || !isRedisConnected) return;
        try {
            await redisClient.setex(key, ttl, value);
        } catch (error) {
            console.warn(`[CacheHelper] Lỗi khi lưu cache cho key ${key}:`, error.message);
        }
    },

    del: async (key) => {
        if (!isRedisEnabled || !isRedisConnected) return;
        try {
            await redisClient.del(key);
        } catch (error) {
            console.warn(`[CacheHelper] Lỗi khi xóa cache cho key ${key}:`, error.message);
        }
    }
};

module.exports = cacheHelper;
