const { Queue } = require('bullmq');
const Redis = require('ioredis');

const isRedisEnabled = process.env.USE_REDIS !== 'false';

let emailQueue;
let queueConnection = null;

if (isRedisEnabled) {
    queueConnection = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null,
        retryStrategy(times) {
            return 5000;
        }
    });

    let queueErrorLogged = false;
    queueConnection.on('error', (err) => {
        if (!queueErrorLogged) {
            console.error('BullMQ Redis Error:', err.message, '- Retrying connection in background (every 5s)...');
            queueErrorLogged = true;
        }
    });

    queueConnection.on('connect', () => {
        queueErrorLogged = false;
    });

    emailQueue = new Queue('emailQueue', { 
        connection: queueConnection,
        defaultJobOptions: {
            removeOnComplete: true, 
            removeOnFail: true      
        }
    });
} else {
    emailQueue = {
        add: async (name, data) => {
            const { processEmailJob } = require('../workers/emailWorker');
            setTimeout(async () => {
                try {
                    await processEmailJob({ name, data });
                } catch (error) {
                    console.error('[MockQueue] Job failed:', error);
                }
            }, 0);
        }
    };
}

module.exports = { emailQueue, connection: queueConnection };
