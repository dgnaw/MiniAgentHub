const aiService = require('../services/aiService');
const chatService = require('../services/chatService');
const userService = require('../services/userService');
const aiFactory = require('../services/aiStrategies/aiFactory');
const catchAsync = require('../utils/catchAsync');
const streamManager = require('../services/streamManager');

const cleanBase64Images = (text) => {
    if (!text) return text;
    return text.replace(/!\[(.*?)\]\(data:image\/[^;]+;base64,[^\)]+\)/g, '[Hình ảnh đính kèm: $1]');
};

const sendSSE = (res, type, data) => {
    if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
    }
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

        try {
            const { message, sessionId, model, isPing } = req.body;
            const files = req.files || [];

            const userId = req.user.id;
            const userKeys = await userService.getUserApiKeys(userId);
            const customGroqKey = userKeys.groq_api_key;
            const customFlowiseUrl = userKeys.flowise_api_url;

            if (isPing) {
                const groqReady = !!(customGroqKey?.trim() || (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== ''));
                const flowiseReady = !!(customFlowiseUrl?.trim() || (process.env.FLOWISE_API_URL && process.env.FLOWISE_API_URL.trim() !== ''));
                return res.status(200).json({ ready: groqReady, flowiseReady: flowiseReady });
            }

            if (!message && files.length === 0) {
                return res.status(400).json({ message: req.t('ai.emptyMessage') });
            }

            if (message && message.length > 5000) {
                return res.status(400).json({ message: req.t('ai.messageTooLong') });
            }

            const cleanMessage = cleanBase64Images(message) || '';

            if (files && files.length > 0) {
                files.forEach(file => {
                    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
                });
            }

            const [fileData] = await Promise.all([
                aiService.processChatAttachment(files, message, cleanMessage, model)
            ]);

            aiProcessData = await chatService.prepareChatSessionAndMessage(userId, sessionId, cleanMessage, fileData.messageToSave, parsedEditIndex, customGroqKey);
            const { currentSessionId, userMessageRecord } = aiProcessData;

            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            sendSSE(res, 'session', { 
                sessionId: currentSessionId,
                userMessageContent: userMessageRecord?.content 
            });

            aiResponse = "";
            
            streamManager.addStream(currentSessionId);
            if (sessionId !== currentSessionId) {
                streamManager.setNewSessionId(currentSessionId, currentSessionId);
            }

            const strategyParams = {
                model,
                userId,
                currentSessionId,
                processedMessage: fileData.processedMessage,
                flowiseUploads: fileData.flowiseUploads,
                customFlowiseUrl,
                customGroqKey,
                cleanBase64Images,
                t: req.t
            };

            const chatStrategy = aiFactory.getChatStrategy(model);
            const stream = chatStrategy.generateStream(strategyParams);

            for await (const event of stream) {
                if (streamManager.getStream(currentSessionId)?.isStopped) {
                    console.log('Stream emergency stopped by user!');
                    break;
                }
                
                if (clientDisconnected || req.socket?.destroyed) {
                    console.log('Client disconnected. Stopping AI stream immediately!');
                    break; 
                }
                
                if (event.error) {
                    streamManager.emitError(currentSessionId, event.error);
                    if (!clientDisconnected) {
                        sendSSE(res, 'error', { message: event.error });
                    }
                    aiResponse += `\n\n*(Lỗi: ${event.error.trim()})*`;
                    break;
                }
                
                if (event.flowiseUnavailable) {
                    streamManager.emitFlowiseUnavailable(currentSessionId);
                    if (!clientDisconnected) {
                        sendSSE(res, 'warning', { code: 'FLOWISE_UNAVAILABLE' });
                    }
                }
                
                if (event.chunk) {
                    aiResponse += event.chunk;
                    streamManager.emitChunk(currentSessionId, event.chunk);
                    if (!clientDisconnected) {
                        sendSSE(res, 'chunk', { content: event.chunk });
                    }
                }
            }

            streamManager.emitDone(currentSessionId);

            if (clientDisconnected || req.socket?.destroyed) {
                console.log('Client disconnected, AI background task completed. Saving response...');
                if (aiResponse) {
                    await chatService.saveAIMessage(currentSessionId, aiResponse);
                }
                setTimeout(() => streamManager.removeStream(currentSessionId), 5000);
                return;
            }

            await chatService.saveAIMessage(currentSessionId, aiResponse);
            streamManager.removeStream(currentSessionId);

            res.write(`data: [DONE]\n\n`);
            res.end();
        } catch (error) {
            console.error('Error in aiController.chat:', error);

            if (clientDisconnected || req.destroyed || req.socket?.destroyed) {
                console.log('Error occurred when request cancelled by client. Saving current AI response...');
                try {
                    const sessionIdToSave = aiProcessData.currentSessionId;
                    if (sessionIdToSave && aiResponse) {
                        await chatService.saveAIMessage(sessionIdToSave, aiResponse);
                    }
                } catch (saveErr) {
                    console.error('Error saving AI response when cancelled:', saveErr);
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

            if (aiProcessData && aiProcessData.currentSessionId) {
                streamManager.emitError(aiProcessData.currentSessionId, errorMessage);
                streamManager.removeStream(aiProcessData.currentSessionId);
                
                try {
                    await chatService.saveAIMessage(aiProcessData.currentSessionId, `*(Lỗi: ${errorMessage.trim()})*`);
                } catch(e) {}
            }

            if (!res.headersSent) {
                return next(error);
            } else {
                sendSSE(res, 'error', { message: errorMessage });
                res.write(`data: [DONE]\n\n`);
                res.end();
            }
        }
    },

    reconnectStream: async (req, res, next) => {
        const { sessionId } = req.params;
        const streamData = streamManager.getStream(sessionId);
        
        if (!streamData) {
            return res.status(404).json({ message: 'Stream not found or already completed' });
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        sendSSE(res, 'session', { sessionId: streamData.newSessionId || sessionId });

        if (streamData.fullText) {
            sendSSE(res, 'chunk', { content: streamData.fullText });
        }

        const onChunk = (chunk) => sendSSE(res, 'chunk', { content: chunk });
        const onError = (err) => sendSSE(res, 'error', { message: err });
        const onFlowiseUnavailable = () => sendSSE(res, 'warning', { code: 'FLOWISE_UNAVAILABLE' });
        const onDone = () => {
            res.write(`data: [DONE]\n\n`);
            res.end();
            cleanup();
        };

        streamData.emitter.on('chunk', onChunk);
        streamData.emitter.on('error', onError);
        streamData.emitter.on('flowiseUnavailable', onFlowiseUnavailable);
        streamData.emitter.on('done', onDone);

        const cleanup = () => {
            streamData.emitter.off('chunk', onChunk);
            streamData.emitter.off('error', onError);
            streamData.emitter.off('flowiseUnavailable', onFlowiseUnavailable);
            streamData.emitter.off('done', onDone);
        };

        res.on('close', cleanup);
    },

    getModels: catchAsync(async (req, res, next) => {
        const userId = req.user.id;
        const userKeys = await userService.getUserApiKeys(userId);
        const customGroqKey = userKeys.groq_api_key;
        const models = await aiService.getAvailableModels(customGroqKey);
        return res.status(200).json(models);
    })
};

module.exports = aiController;
