const aiService = require('./src/services/aiService');
const url = 'https://cloud.flowiseai.com/api/v1/prediction/a18ab019-37ec-4cb4-87e1-8e12a6f263cb';
const run = async () => {
    const stream = aiService.chatWithFlowiseStream('hi', 'test-session', [], url);
    for await (const event of stream) {
        console.log("YIELDED EVENT:", event);
    }
};
run().catch(console.error);
