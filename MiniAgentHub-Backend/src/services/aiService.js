const Groq = require('groq-sdk');
const axios = require('axios');
const fs = require('fs');
const pdfParse = require('pdf-parse-new');
const Tesseract = require('tesseract.js');

const client = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const aiService = {
    extractFileContent: async (file) => {
        let fileContent = '';
        const filePath = file.path;

        try {
            if (file.mimetype === 'application/pdf') {
                const dataBuffer = fs.readFileSync(filePath);
                
                try {
                    const pdfData = await pdfParse(dataBuffer);
                    fileContent = pdfData.text;
                } catch (pdfErr) {
                    console.error("Lỗi khi parse PDF:", pdfErr);
                    fileContent = "(Hệ thống không thể đọc được nội dung văn bản từ file PDF này. Có thể đây là file ảnh scan hoặc bị hỏng định dạng.)";
                }
            } else if (file.mimetype.startsWith('image/')) {
                try {
                    const result = await Tesseract.recognize(filePath, 'vie+eng');
                    fileContent = result.data.text;
                    if (!fileContent.trim()) {
                        fileContent = "(Không tìm thấy chữ/văn bản nào trong hình ảnh.)";
                    }
                } catch (ocrErr) {
                    console.error("Lỗi khi nhận diện ảnh (OCR):", ocrErr);
                    fileContent = "(Hệ thống không thể trích xuất văn bản từ hình ảnh này do lỗi định dạng.)";
                }
            } else if (
                file.mimetype.includes('text') || 
                file.mimetype.includes('csv') || 
                file.mimetype === 'application/json' ||
                file.mimetype === 'application/vnd.ms-excel' ||
                /\.(csv|txt|json|md)$/i.test(file.originalname)
            ) {
                fileContent = fs.readFileSync(filePath, 'utf8');
            } else {
                throw new Error('UNSUPPORTED_FILE_TYPE');
            }
        } finally {
            // Đảm bảo dọn dẹp file rác ở mọi trường hợp (thành công lẫn khi bị lỗi)
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        return fileContent;
    },

    chatWithAIStream: async (messagesHistory) => {
        try {
            const stream = await client.chat.completions.create({
                messages: messagesHistory,
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
                    { role: 'system', content: 'Bạn là AI chuyên tóm tắt tin nhắn thành tiêu đề ngắn (tối đa 6 từ). CHỈ trả về phần tiêu đề, không có tiền tố như "Tiêu đề:", không giải thích, không dùng dấu ngoặc kép hay markdown.' },
                    { role: 'user', content: message }
                ],
                model: 'llama-3.1-8b-instant', 
                max_tokens: 40,
                temperature: 0.3
            });
            
            let title = response.choices[0]?.message?.content?.replace(/["'*]/g, '').trim() || "";
            title = title.replace(/^(Tiêu đề:\s*|Title:\s*)/i, '').trim();
            return title;
        } catch (error) {
            console.error("Lỗi khi tạo tiêu đề bằng Groq SDK:", error.message);
            return null; 
        }
    },

    chatWithFlowise: async (message, sessionId, uploads = []) => {
        const flowiseUrl = process.env.FLOWISE_API_URL;
        try {
            const payload = {
                question: message,
                overrideConfig: {
                    sessionId: sessionId 
                }
            };
            
            if (uploads && uploads.length > 0) {
                payload.uploads = uploads;
            }
            
            const flowiseRes = await axios.post(flowiseUrl, payload);
            let aiResponse = flowiseRes.data.text || flowiseRes.data;
            let flowiseFailed = false;

            if (typeof aiResponse === 'string' && (aiResponse.trim().startsWith('<!DOCTYPE') || aiResponse.trim().startsWith('<html') || aiResponse.includes('<link rel="preconnect"'))) {
                flowiseFailed = true;
                aiResponse = "";
            }
            return { response: aiResponse, failed: flowiseFailed };
        } catch (error) {
            console.error('Lỗi khi gọi API Flowise:', error.response?.data || error.message);
            return { response: "", failed: true };
        }
    }
};

module.exports = aiService;
