const aiService = require('../services/aiService');
const chatService = require('../services/chatService');

// Hàm gỡ bỏ hình ảnh Base64 khổng lồ ra khỏi văn bản trước khi đưa cho AI đọc
const cleanBase64Images = (text) => {
    if (!text) return text;
    return text.replace(/!\[(.*?)\]\(data:image\/[^;]+;base64,[^\)]+\)/g, '[🖼️ Hình ảnh đính kèm: $1]');
};

const aiController = {
    chat: async (req, res) => {
        let aiProcessData = {};
        const parsedEditIndex = req.body.editIndex !== undefined ? parseInt(req.body.editIndex, 10) : undefined;

        try {
            const { message, sessionId, model, isPing } = req.body;
            const file = req.file;

            if (isPing) {
                const groqReady = !!(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== '');
                const flowiseReady = !!(process.env.FLOWISE_API_URL && process.env.FLOWISE_API_URL.trim() !== '');
                return res.status(200).json({ ready: groqReady, flowiseReady: flowiseReady });
            }

            const userId = req.user.id;

            if (!message && !file) {
                return res.status(400).json({ message: 'Vui lòng cung cấp nội dung câu hỏi hoặc file đính kèm.' });
            }

            const cleanMessage = cleanBase64Images(message) || '';
            const fileData = await aiService.processChatAttachment(file, message, cleanMessage, model);
            
            aiProcessData = await chatService.prepareChatSessionAndMessage(userId, sessionId, cleanMessage, fileData.messageToSave, parsedEditIndex);
            const { currentSessionId } = aiProcessData;

            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            
            res.write(`data: ${JSON.stringify({ sessionId: currentSessionId })}\n\n`);

            let aiResponse = "";
            let flowiseFailed = false;

            if (model === "Data Analyst") {
                const flowiseResult = await aiService.chatWithFlowise(fileData.processedMessage, currentSessionId, fileData.flowiseUploads);
                aiResponse = flowiseResult.response;
                flowiseFailed = flowiseResult.failed;

                if (!flowiseFailed) {
                    res.write(`data: ${JSON.stringify({ chunk: aiResponse })}\n\n`);
                }
            }
            
            if (model !== "Data Analyst" || flowiseFailed) {
                if (flowiseFailed) {
                    res.write(`data: ${JSON.stringify({ flowiseUnavailable: true })}\n\n`);
                }
                
                const messagesForAI = await aiService.buildMessagesForAI(userId, currentSessionId, fileData.processedMessage, cleanBase64Images);

                const stream = await aiService.chatWithAIStream(messagesForAI);
                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || "";
                    if (content) {
                        aiResponse += content;
                        res.write(`data: ${JSON.stringify({ chunk: content })}\n\n`);
                    }
                }
            }

            await chatService.saveAIMessage(currentSessionId, aiResponse);

            res.write(`data: [DONE]\n\n`);
            res.end();
        } catch (error) {
            console.error('Lỗi tại aiController.chat:', error);

            await chatService.cleanupOnError(aiProcessData.userMessageRecord, aiProcessData.isNewSession, aiProcessData.currentSessionId, parsedEditIndex);

            let errorMessage = '\n\nĐã xảy ra lỗi trong quá trình xử lý.';
            if (error.status === 401 || (error.message && error.message.includes('Invalid API Key'))) {
                errorMessage = '\n\nLỗi hệ thống: API Key của hệ thống AI (Groq) không hợp lệ hoặc chưa được cấu hình. Vui lòng kiểm tra lại file .env của backend.';
            } else if (error.status === 400 || error.status === 500) {
                errorMessage = `\n\nLỗi hệ thống: ${error.message}`;
            }

            if (!res.headersSent) {
                return res.status(error.status || 500).json({ message: error.message || 'Lỗi server khi xử lý yêu cầu AI.' });
            } else {
                res.write(`data: ${JSON.stringify({ chunk: errorMessage })}\n\n`);
                res.write(`data: [DONE]\n\n`);
                res.end();
            }
        }
    }
};

module.exports = aiController;
