const Groq = require('groq-sdk');

const client = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const aiService = {
    chatWithAI: async (message) => {
        try {
            const chatCompletion = await client.chat.completions.create({
                messages: [{ role: 'user', content: message }],
                model: 'llama-3.1-8b-instant', 
                temperature: 1,
                max_tokens: 1024,
                top_p: 1,
            });
            return chatCompletion.choices[0]?.message?.content || "";
        } catch (error) {
            console.error("Lỗi khi gọi API Groq:", error);
            throw error;
        }
    },
    chatWithAIStream: async (message) => {
        try {
            const stream = await client.chat.completions.create({
                messages: [{ role: 'user', content: message }],
                model: 'llama-3.1-8b-instant', 
                temperature: 1,
                max_tokens: 1024,
                top_p: 1,
                stream: true, 
            });
            return stream;
        } catch (error) {
            console.error("Lỗi khi gọi API Groq (Stream):", error);
            throw error;
        }
    }
};

module.exports = aiService;
