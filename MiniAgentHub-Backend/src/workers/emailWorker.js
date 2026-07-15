const { Worker } = require('bullmq');
const { connection } = require('../config/queue');
const { sendWelcomeEmail, sendResetPasswordEmail } = require('../utils/emailService');

const processEmailJob = async (job) => {
    if (job.name === 'welcomeEmail') {
        const { email, full_name, password, lng } = job.data;
        await sendWelcomeEmail(email, full_name, password, lng);
        console.log(`[Worker] Sent welcome email to ${email}`);
    } else if (job.name === 'resetPasswordEmail') {
        const { email, full_name, password, lng } = job.data;
        await sendResetPasswordEmail(email, full_name, password, lng);
        console.log(`[Worker] Sent reset password email to ${email}`);
    }
};

let emailWorker = null;
const isRedisEnabled = process.env.USE_REDIS !== 'false';

if (isRedisEnabled) {
    emailWorker = new Worker('emailQueue', processEmailJob, { connection });

    emailWorker.on('completed', job => {
        console.log(`[Worker] Job ${job.id} has completed!`);
    });

    emailWorker.on('failed', (job, err) => {
        console.error(`[Worker] Job ${job.id} has failed with ${err.message}`);
    });
}

module.exports = {
    emailWorker,
    processEmailJob
};
