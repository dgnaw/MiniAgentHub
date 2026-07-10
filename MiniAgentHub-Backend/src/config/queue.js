const { Queue } = require('bullmq');
const redisClient = require('./redis');

const connection = {
    host: process.env.REDIS_HOST ,
    port: process.env.REDIS_PORT ,
    password: process.env.REDIS_PASSWORD || undefined,
};

const emailQueue = new Queue('emailQueue', { 
    connection,
    defaultJobOptions: {
        removeOnComplete: true, 
        removeOnFail: true      
    }
});

module.exports = { emailQueue, connection };
