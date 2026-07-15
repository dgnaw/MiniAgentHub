const Redis = require('ioredis');

const isRedisEnabled = process.env.USE_REDIS !== 'false';

let redisClient = null;

if (isRedisEnabled) {
    let errorLogged = false;

    redisClient = new Redis(process.env.REDIS_URL, {
        retryStrategy(times) {
            return 5000;
        },
        maxRetriesPerRequest: 1 
    });

    redisClient.on('connect', () => {
        console.log('Connected to Redis successfully');
        errorLogged = false;
    });

    redisClient.on('error', (err) => {
        if (!errorLogged) {
            console.error('Redis Connection Error:', err.message, '- Đang thử kết nối lại ngầm (mỗi 5s)...');
            errorLogged = true;
        }
    });
} else {
    redisClient = {
        on: () => {},
        call: () => {}
    };
}

module.exports = redisClient;
