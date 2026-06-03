const Groq = require('groq-sdk');

const client = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const aiService = {
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
    },

    generateTitle: async (message) => {
        try {
            const response = await client.chat.completions.create({
                messages: [
                    { role: 'system', content: 'Tóm tắt câu hỏi sau thành một tiêu đề thật ngắn gọn (tối đa 6 từ). Chỉ trả về nội dung tiêu đề, không giải thích thêm, không dùng dấu ngoặc kép, không dùng định dạng markdown.' },
                    { role: 'user', content: message }
                ],
                model: 'llama-3.1-8b-instant', 
                max_tokens: 15,
                temperature: 0.5
            });
            return response.choices[0]?.message?.content?.replace(/["'*]/g, '').trim();
        } catch (error) {
            console.error("Lỗi khi tạo tiêu đề bằng Groq SDK:", error.message);
            return null; 
        }
    }
};

module.exports = aiService;
