const Groq = require('groq-sdk');
const fs = require('fs');
const fsp = fs.promises;
const pdfParse = require('pdf-parse-new');
const Tesseract = require('tesseract.js');
const AppError = require('../utils/AppError');
const aiPrompts = require('../utils/aiPrompts');
const chatService = require('./chatService');

const crypto = require('crypto');
const cacheHelper = require('../utils/cacheHelper');

let tesseractWorkerPromise = null;
const getTesseractWorker = () => {
    if (!tesseractWorkerPromise) {
        tesseractWorkerPromise = (async () => {
            console.log("Initializing Tesseract OCR Worker (vie+eng)...");
            const worker = await Tesseract.createWorker('vie+eng');
            console.log("Tesseract OCR Worker is ready.");
            return worker;
        })(); 
    }
    return tesseractWorkerPromise;
}

const getGroqClient = (customKey) => {
    const key = customKey || process.env.GROQ_API_KEY;
    if (!key || key.trim() === '') {
        throw new AppError('ai.apiKeyInvalid', 'BAD_REQUEST');
    }
    return new Groq({
        apiKey: key
    });
};

const aiService = {
    extractFileContent: async (file) => {
        let fileContent = '';
        const filePath = file.path;

        try {
            if (file.mimetype === 'application/pdf') {
                const dataBuffer = await fsp.readFile(filePath);

                try {
                    const pdfData = await pdfParse(dataBuffer);
                    fileContent = pdfData.text;
                } catch (pdfErr) {
                    console.error("Error parsing PDF:", pdfErr);
                    fileContent = aiPrompts.FILE_READ_ERRORS.PDF_PARSE_ERROR;
                }
            } else if (file.mimetype.startsWith('image/')) {
                try {
                    const worker = await getTesseractWorker();
                    const result = await worker.recognize(filePath);
                    fileContent = result.data.text;
                    if (!fileContent.trim()) {
                        fileContent = aiPrompts.FILE_READ_ERRORS.OCR_NO_TEXT;
                    }
                } catch (ocrErr) {
                    console.error("Error recognizing image (OCR):", ocrErr);
                    fileContent = aiPrompts.FILE_READ_ERRORS.OCR_FORMAT_ERROR;
                }
            } else if (
                file.mimetype.includes('text') ||
                file.mimetype.includes('csv') ||
                file.mimetype === 'application/json' ||
                /\.(csv|txt|json|md|xml|html|js|jsx|ts|tsx|py|java|c|cpp|cs|h|css|scss|sql|sh|bat)$/i.test(file.originalname)
            ) {
                const rawContent = await fsp.readFile(filePath, 'utf8');
                fileContent = rawContent.length > 10000000 ? rawContent.substring(0, 10000000) + '\n\n[Nội dung đã bị cắt bớt do quá dài...]' : rawContent;
            } else {
                fileContent = aiPrompts.FILE_READ_ERRORS.UNSUPPORTED_FORMAT(file.originalname);
            }
        } catch (err) {
            console.error("Error extracting file content:", err);
            fileContent = aiPrompts.FILE_READ_ERRORS.GENERAL_ERROR;
        }

        return fileContent;
    },

    chatWithAIStream: async (messagesHistory, modelId, customKey) => {
        try {
            const localClient = getGroqClient(customKey);
            const stream = await localClient.chat.completions.create({
                messages: messagesHistory,
                model: modelId || 'llama-3.1-8b-instant',
                temperature: 1,
                max_tokens: 4096,
                top_p: 1,
                stream: true,
            });
            return stream;
        } catch (error) {
            console.error("Error calling Groq API (Stream):", error);
            throw error;
        }
    },

    generateTitle: async (message, customKey) => {
        try {
            const localClient = getGroqClient(customKey);
            const response = await localClient.chat.completions.create({
                messages: [
                    { role: 'system', content: aiPrompts.SYSTEM_PROMPTS.GENERATE_TITLE },
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
            console.error("Error generating title with Groq SDK:", error.message);
            return null;
        }
    },


    buildMessagesForAI: async (userId, currentSessionId, processedMessage, cleanBase64ImagesFn) => {
        const pastMessagesResponse = await chatService.getSessionMessages(currentSessionId, userId, 1, 10);
        const pastMessages = pastMessagesResponse.data || [];

        const systemContent = aiPrompts.SYSTEM_PROMPTS.BASE_SYSTEM_PROMPT;

        const messageForAI = [
            { role: 'system', content: systemContent },
            ...pastMessages.map((m, index) => {
                let content = cleanBase64ImagesFn(m.content);
                if (index < pastMessages.length - 1 && content.length > 2000) {
                    content = content.substring(0, 2000) + '\n...[Nội dung quá dài đã được rút gọn]';
                }
                return {
                    role: m.role === 'ai' ? 'assistant' : 'user',
                    content: content
                };
            })
        ];

        if (messageForAI.length > 0 && messageForAI[messageForAI.length - 1].role === 'user') {
            messageForAI[messageForAI.length - 1].content = processedMessage;
        }

        return messageForAI;
    },

    processChatAttachment: async (files, message, cleanMessage, model) => {
        let processedMessage = cleanMessage || '';
        let messageToSave = message || '';
        let flowiseUploads = [];

        let allExtractedTexts = '';
        try {
            if (files && files.length > 0) {
                const processFilterPromises = files.map(async (file) => {
                    let localBase64Data = null;
                    let fileExtractedText = '';
                    let fileFlowiseUpload = null;
                    let replacement = null;

                    const safeName = file.originalname.replace(/[\\]/g, '_');
                    if (file.mimetype.startsWith('image/')) {
                        const fileData = await fsp.readFile(file.path);
                        localBase64Data = fileData.toString('base64');
                        const ext = require('path').extname(file.originalname) || '.png';

                        const crypto = require('crypto');
                        const hash = crypto.createHash('md5').update(fileData).digest('hex');
                        const newFilename = `${hash}${ext}`;
                        const newPath = require('path').join(require('path').dirname(file.path), newFilename);

                        if (fs.existsSync(newPath)) {
                            await fsp.unlink(file.path);
                            file.path = newPath;
                        } else {
                            await fsp.rename(file.path, newPath);
                            file.path = newPath;
                        }

                        const publicUrl = `/api/uploads/${newFilename}`;
                        replacement = {
                            from: `[🖼️ Hình ảnh đính kèm: ${safeName}]`,
                            to: `![${safeName}](${publicUrl})`
                        };
                    } else {
                        replacement = {
                            from: `[📎 File đính kèm: ${safeName}]`,
                            to: `[📎 File đính kèm: ${file.originalname}]`
                        };
                    }

                    const aiFactory = require('./aiStrategies/aiFactory');
                    const strategy = aiFactory.getChatStrategy(model);
                    
                    if (strategy && strategy.processAttachment) {
                        const attachmentResult = await strategy.processAttachment(file, localBase64Data);
                        if (attachmentResult.fileFlowiseUpload) {
                            fileFlowiseUpload = attachmentResult.fileFlowiseUpload;
                        }
                        if (attachmentResult.fileExtractedText) {
                            fileExtractedText = attachmentResult.fileExtractedText;
                        }
                    }

                    if (!file.mimetype.startsWith('image/')) {
                        await fsp.unlink(file.path).catch(() => { });
                    }

                    return { replacement, fileFlowiseUpload, fileExtractedText, mime: file.mimetype };
                });

                const results = await Promise.all(processFilterPromises);

                for (const res of results) {
                    if (res.replacement) {
                        messageToSave = messageToSave.replace(res.replacement.from, res.replacement.to);
                    }
                    if (res.fileFlowiseUpload) {
                        flowiseUploads.push(res.fileFlowiseUpload);
                    }
                    if (res.fileExtractedText) {
                        allExtractedTexts += res.fileExtractedText;
                    }
                }

                if (allExtractedTexts.trim() !== '') {
                    processedMessage = aiPrompts.ATTACHMENT_PROMPTS.OCR_CONTEXT(allExtractedTexts, processedMessage);
                }

                if (model === "Data Analyst" && flowiseUploads.some(u => u.mime.startsWith('image/'))) {
                    const visionPrompt = aiPrompts.ATTACHMENT_PROMPTS.VISION_REQUIREMENT;
                    processedMessage = processedMessage + visionPrompt;
                }
            }
        } catch (err) {
            console.error("Error processing attachment:", err);
            if (files && files.length > 0) {
                for (const file of files) {
                    if (file.path && fs.existsSync(file.path)) {
                        await fsp.unlink(file.path).catch(() => { });
                    }
                }
            }
            if (err instanceof AppError) throw err;
            throw new AppError('ai.fileReadError', 'INTERNAL_ERROR');
        }

        return { processedMessage, messageToSave, flowiseUploads };
    },

    getAvailableModels: async (customKey) => {
        try {
            const cacheKey = customKey 
                ? `groq:models:${crypto.createHash('md5').update(customKey).digest('hex')}`
                : 'groq:models:default';
                
            const cachedModels = await cacheHelper.get(cacheKey);
            if (cachedModels) {
                return JSON.parse(cachedModels);
            }

            const localClient = getGroqClient(customKey);
            const list = await localClient.models.list();
            if (!list || !list.data) return [];

            const formatModelName = (id) => {
                return id
                    .split('-')
                    .map(word => {
                        if (/^\d+[bB]$/.test(word) || word === '8x7b' || word === '32k' || word === '8k' || word === '8192') {
                            return word.toUpperCase();
                        }
                        if (word === 'it') return 'IT';
                        return word.charAt(0).toUpperCase() + word.slice(1);
                    })
                    .join(' ');
            };

            const result = list.data
                .filter(model => {
                    const idLower = model.id.toLowerCase();
                    return !idLower.includes('whisper') &&
                        !idLower.includes('guard') &&
                        !idLower.includes('embed') &&
                        !idLower.includes('moderation');
                })
                .map(model => {
                    return {
                        id: model.id,
                        name: formatModelName(model.id),
                        desc: `Cung cấp bởi ${model.owned_by || 'Groq'}`
                    };
                });
                
            await cacheHelper.setex(cacheKey, 86400, JSON.stringify(result)); // Cache 24 hours
            return result;
        } catch (error) {
            console.error("Error fetching model list from Groq API:", error.message);
            throw error;
        }
    }
};

module.exports = aiService;
