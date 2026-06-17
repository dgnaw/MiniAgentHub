const Groq = require('groq-sdk');
const axios = require('axios');
const fs = require('fs');
const pdfParse = require('pdf-parse-new');
const Tesseract = require('tesseract.js');
const ChatSession = require('../models/chatSession');
const ChatMessage = require('../models/chatMessage');

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
                /\.(csv|txt|json|md|xml|html|js|jsx|ts|tsx|py|java|c|cpp|cs|h|css|scss|sql|sh|bat)$/i.test(file.originalname)
            ) {
                fileContent = fs.readFileSync(filePath, 'utf8');
            } else {
                fileContent = `(Hệ thống không thể đọc nội dung chi tiết của định dạng file này. Tên file đính kèm: ${file.originalname})`;
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
    },

    buildMessagesForAI: async (userId, currentSessionId, processedMessage, cleanBase64ImagesFn) => {
        // 1. Lấy Global Context (Ký ức dài hạn) từ các phiên khác
        const userSessions = await ChatSession.findAll({ where: { user_id: userId }, attributes: ['id'] });
        const otherSessionIds = userSessions.map(s => s.id).filter(id => id !== currentSessionId);
        
        let globalContextStr = "";
        if (otherSessionIds.length > 0) {
            const globalMessages = await ChatMessage.findAll({
                where: { session_id: otherSessionIds },
                order: [['created_at', 'DESC']],
                limit: 10 // Chỉ lấy 10 tin nhắn gần nhất để tránh tràn Token
            });
            globalContextStr = globalMessages.reverse().map(m => {
                let safeContent = cleanBase64ImagesFn(m.content);
                if (safeContent && safeContent.length > 500) safeContent = safeContent.substring(0, 500) + '...';
                return `${m.role === 'ai' ? 'AI' : 'User'}: ${safeContent}`;
            }).join('\n');
        }
        
        const systemContent = globalContextStr
            ? `Bạn là một trợ lý AI thông minh, nhiệt tình của Neural Hub. Luôn trả lời bằng Tiếng Việt, định dạng văn bản rõ ràng bằng Markdown.\n\nDưới đây là thông tin từ các cuộc trò chuyện ở các phiên khác của người dùng để bạn tham khảo ngữ cảnh (Ký ức dài hạn):\n"""\n${globalContextStr}\n"""`
            : 'Bạn là một trợ lý AI thông minh, nhiệt tình của Neural Hub. Luôn trả lời bằng Tiếng Việt, định dạng văn bản rõ ràng bằng Markdown.';

        // 2. Lấy lịch sử trò chuyện của phiên hiện tại từ DB
        const pastMessages = await ChatMessage.findAll({
            where: { session_id: currentSessionId },
            order: [['created_at', 'ASC']]
        });

        // 3. Chuyển đổi định dạng cho AI
        const messagesForAI = [
            { role: 'system', content: systemContent },
            ...pastMessages.slice(-20).map(m => ({
                role: m.role === 'ai' ? 'assistant' : 'user',
                content: cleanBase64ImagesFn(m.content)
            }))
        ];

        // Ghi đè nội dung tin nhắn cuối cùng (gộp cả phần text của file đính kèm nếu có)
        if (messagesForAI.length > 0 && messagesForAI[messagesForAI.length - 1].role === 'user') {
            messagesForAI[messagesForAI.length - 1].content = processedMessage;
        }

        return messagesForAI;
    },

    processChatAttachments: async (files, message, cleanMessage, model) => {
        let processedMessage = cleanMessage || '';
        let messageToSave = message || '';
        let flowiseUploads = [];
        let allExtractedText = '';

        try {
            if (files && files.length > 0) {
                for (const file of files) {
                    let base64Data = null;
                    if (file.mimetype.startsWith('image/')) {
                        const fileData = fs.readFileSync(file.path);
                        base64Data = fileData.toString('base64');
                    }

                    if (model === "Data Analyst") {
                        if (file.mimetype.startsWith('image/')) {
                            const fileContent = await aiService.extractFileContent(file);
                            allExtractedText += `\n--- Tài liệu: ${file.originalname} ---\n${fileContent}\n`;
                        } else {
                            if (!base64Data) {
                                const fileData = fs.readFileSync(file.path);
                                base64Data = fileData.toString('base64');
                            }
                            flowiseUploads.push({
                                data: `data:${file.mimetype};base64,${base64Data}`,
                                type: 'file',
                                name: file.originalname,
                                mime: file.mimetype
                            });
                            fs.unlinkSync(file.path); 
                        }
                    } else {
                        const fileContent = await aiService.extractFileContent(file);
                        allExtractedText += `\n--- Tài liệu: ${file.originalname} ---\n${fileContent}\n`;
                    }
                }

                messageToSave = messageToSave.replace(
                    /\[🖼️ Hình ảnh đính kèm: (.*?)\]/g,
                    `!$1`
                );

                if (allExtractedText.trim() !== '') {
                    processedMessage = `Người dùng đã tải lên (các) hình ảnh/tài liệu. Hệ thống nhận diện (OCR) đã quét và trích xuất được văn bản sau từ các file đó:\n"""${allExtractedText}"""\n\nDựa vào phần chữ đã được hệ thống trích xuất ở trên, hãy trả lời yêu cầu sau của người dùng. Tuyệt đối KHÔNG được từ chối hoặc nói rằng bạn không thể nhìn thấy hình ảnh:\n\nYêu cầu: ${processedMessage}`;
                }
            }
        } catch (err) {
            console.error("Lỗi xử lý file đính kèm:", err);
            if (files && files.length > 0) {
                for (const file of files) {
                    if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
                }
            }
            
            const error = new Error();
            error.status = 500;
            error.message = 'Lỗi đọc file. Có thể thư viện đọc file bị lỗi hoặc file bị hỏng.';
            throw error;
        }

        return { processedMessage, messageToSave, flowiseUploads };
    }
};

module.exports = aiService;
