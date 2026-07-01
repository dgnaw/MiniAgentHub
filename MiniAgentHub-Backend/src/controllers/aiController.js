const aiService = require('../services/aiService');
const chatService = require('../services/chatService');

// Hàm gỡ bỏ hình ảnh Base64 khổng lồ ra khỏi văn bản trước khi đưa cho AI đọc
const cleanBase64Images = (text) => {
    if (!text) return text;
    return text.replace(/!\[(.*?)\]\(data:image\/[^;]+;base64,[^\)]+\)/g, '[🖼️ Hình ảnh đính kèm: $1]');
};

const aiController = {
    chat: async (req, res, next) => {
        let aiProcessData = {};
        let aiResponse = "";
        let clientDisconnected = false;
        const parsedEditIndex = req.body.editIndex !== undefined ? parseInt(req.body.editIndex, 10) : undefined;

        res.on('close', () => {
            if (!res.writableEnded) {
                clientDisconnected = true;
            }
        });

        const customGroqKey = req.headers['x-groq-api-key'];
        const customFlowiseUrl = req.headers['x-flowise-api-url'];

        try {
            const { message, sessionId, model, isPing } = req.body;
            const files = req.files || [];

            if (isPing) {
                const groqReady = !!(customGroqKey?.trim() || (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== ''));
                const flowiseReady = !!(customFlowiseUrl?.trim() || (process.env.FLOWISE_API_URL && process.env.FLOWISE_API_URL.trim() !== ''));
                return res.status(200).json({ ready: groqReady, flowiseReady: flowiseReady });
            }

            const userId = req.user.id;

            if (!message && files.length === 0) {
                return res.status(400).json({ message: req.t('ai.emptyMessage') });
            }

            if (message && message.length > 5000) {
                return res.status(400).json({ message: req.t('ai.messageTooLong') });
            }

            const cleanMessage = cleanBase64Images(message) || '';
            const fileData = await aiService.processChatAttachments(files, message, cleanMessage, model);

            aiProcessData = await chatService.prepareChatSessionAndMessage(userId, sessionId, cleanMessage, fileData.messageToSave, parsedEditIndex, customGroqKey);
            const { currentSessionId } = aiProcessData;

            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            res.write(`data: ${JSON.stringify({ sessionId: currentSessionId })}\n\n`);

            aiResponse = "";
            let flowiseFailed = false;

            if (model === "Data Analyst") {
                const flowiseStream = aiService.chatWithFlowiseStream(fileData.processedMessage, currentSessionId, fileData.flowiseUploads, customFlowiseUrl);
                for await (const event of flowiseStream) {
                    if (clientDisconnected || req.socket?.destroyed) {
                        clientDisconnected = true;
                        break;
                    }
                    if (event.failed) {
                        flowiseFailed = true;
                        break;
                    }
                    if (event.chunk) {
                        aiResponse += event.chunk;
                        res.write(`data: ${JSON.stringify({ chunk: event.chunk })}\n\n`);
                    }
                }
            }

            if (model !== "Data Analyst" || flowiseFailed) {
                if (flowiseFailed) {
                    res.write(`data: ${JSON.stringify({ flowiseUnavailable: true })}\n\n`);
                }

                const messagesForAI = await aiService.buildMessagesForAI(userId, currentSessionId, fileData.processedMessage, cleanBase64Images);

                try {
                    const fallbackModel = flowiseFailed ? 'llama-3.1-8b-instant' : model;
                    const stream = await aiService.chatWithAIStream(messagesForAI, fallbackModel, customGroqKey);
                    for await (const chunk of stream) {
                        if (clientDisconnected || req.socket?.destroyed) {
                            clientDisconnected = true;
                            break;
                        }
                        const content = chunk.choices[0]?.delta?.content || "";
                        if (content) {
                            aiResponse += content;
                            res.write(`data: ${JSON.stringify({ chunk: content })}\n\n`);
                        }
                    }
                } catch (groqError) {
                    console.error('Lỗi khi gọi Groq (fallback):', groqError.message);
                    let errMsg;
                    if (groqError.message?.includes('API Key') || groqError.status === 401) {
                        errMsg = req.t('ai.apiKeyInvalid');
                    } else {
                        errMsg = `${req.t('server.internalError')}: ${groqError.message || 'Không thể kết nối tới AI.'}`;
                    }
                    const groqErrChunk = (flowiseFailed ? '' : '') + errMsg;
                    aiResponse += groqErrChunk;
                    res.write(`data: ${JSON.stringify({ chunk: groqErrChunk })}\n\n`);
                }
            }

            if (clientDisconnected || req.socket?.destroyed) {
                console.log('Client ngắt kết nối trước khi kết thúc stream. Lưu câu trả lời AI nhận được...');
                if (aiResponse) {
                    await chatService.saveAIMessage(currentSessionId, aiResponse);
                }
                return;
            }

            await chatService.saveAIMessage(currentSessionId, aiResponse);

            res.write(`data: [DONE]\n\n`);
            res.end();
        } catch (error) {
            console.error('Lỗi tại aiController.chat:', error);

            if (clientDisconnected || req.destroyed || req.socket?.destroyed) {
                console.log('Lỗi xảy ra khi request bị client hủy. Lưu câu trả lời AI hiện tại...');
                try {
                    const sessionIdToSave = aiProcessData.currentSessionId;
                    if (sessionIdToSave && aiResponse) {
                        await chatService.saveAIMessage(sessionIdToSave, aiResponse);
                    }
                } catch (saveErr) {
                    console.error('Lỗi khi lưu câu trả lời AI khi bị hủy:', saveErr);
                }
                return;
            }

            await chatService.cleanupOnError(aiProcessData.userMessageRecord, aiProcessData.isNewSession, aiProcessData.currentSessionId, parsedEditIndex);

            let errorMessage = '\n\nĐã xảy ra lỗi trong quá trình xử lý.';
            if (error.status === 401 || (error.message && error.message.includes('Invalid API Key'))) {
                errorMessage = '\n\n' + req.t('ai.apiKeyInvalid');
            } else if (error.status === 400 || error.status === 500) {
                errorMessage = `\n\n${req.t('server.internalError')}: ${error.message}`;
            }

            if (!res.headersSent) {
                return next(error);
            } else {
                res.write(`data: ${JSON.stringify({ chunk: errorMessage })}\n\n`);
                res.write(`data: [DONE]\n\n`);
                res.end();
            }
        }
    },

    getModels: async (req, res, next) => {
        try {
            const customGroqKey = req.headers['x-groq-api-key'];
            const models = await aiService.getAvailableModels(customGroqKey);
            return res.status(200).json(models);
        } catch (error) {
            next(error);
        }
    }
};

module.exports = aiController;
