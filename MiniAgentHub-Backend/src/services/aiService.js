const Groq = require('groq-sdk');


const fs = require('fs');
const pdfParse = require('pdf-parse-new');
const Tesseract = require('tesseract.js');
const AppError = require('../utils/AppError');
const chatService = require('./chatService');

const getGroqClient = (customKey) => {
    const key = customKey || process.env.GROQ_API_KEY;
    if (!key || key.trim() === '') {
        throw new AppError('ai.apiKeyInvalid', 500);
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
        } catch (err) {
            console.error("Lỗi extract file content:", err);
            fileContent = "(Hệ thống không thể đọc nội dung file này)";
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

    generateTitle: async (message, customKey) => {
        try {
            const localClient = getGroqClient(customKey);
            const response = await localClient.chat.completions.create({
                messages: [
                    { role: 'system', content: 'Bạn là AI chuyên tóm tắt tin nhắn thành tiêu đề ngắn (tối đa 4 từ). CHỈ trả về phần tiêu đề, không có tiền tố như "Tiêu đề:", không giải thích, không dùng dấu ngoặc kép hay markdown.' },
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

    chatWithFlowiseStream: async function* (message, sessionId, uploads = [], customFlowiseUrl) {
        const flowiseUrl = customFlowiseUrl || process.env.FLOWISE_API_URL;
        const payload = {
            question: message,
            streaming: true,
            overrideConfig: { sessionId }
        };

        if (uploads && uploads.length > 0) {
            payload.uploads = uploads;
        }

        let response;
        try {
            response = await fetch(flowiseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (err) {
            console.error('Lỗi kết nối Flowise:', err.message);
            yield { failed: true };
            return;
        }

        if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            console.error('Flowise trả về lỗi HTTP:', response.status, errBody.substring(0, 200));
            yield { failed: true };
            return;
        }

        const contentType = response.headers.get('content-type') || '';

        if (!contentType.includes('text/event-stream')) {
            try {
                const rawText = await response.text();
                const json = JSON.parse(rawText);
                const text = json.text || json.answer || json.output || json.result || JSON.stringify(json);
                if (typeof text === 'string' && (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html'))) {
                    yield { failed: true };
                } else {
                    yield { chunk: text };
                }
            } catch {
                yield { failed: true };
            }
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        const FLOWISE_STATUS_STRINGS = new Set([
            'INProgress', 'done', 'start', 'end', 'error',
            '[DONE]', 'true', 'false', 'null', ''
        ]);

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const rawChunk = decoder.decode(value, { stream: true });
                buffer += rawChunk;

                const blocks = buffer.split('\n\n');
                buffer = blocks.pop();
                for (const block of blocks) {
                    if (!block.trim()) continue;

                    let eventType = null;
                    let dataStr = null;

                    const lines = block.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('event:')) {
                            eventType = line.substring(6).trim();
                        } else if (line.startsWith('data:')) {
                            dataStr = line.substring(5).trim();
                        }
                    }

                    if (!dataStr) continue;

                    if (eventType === 'error') {
                        try {
                            const errParsed = JSON.parse(dataStr);
                            const errMsg = errParsed.data || errParsed.message || 'Flowise error';
                            yield { failed: true, errorMessage: errMsg };
                        } catch {
                            yield { failed: true };
                        }
                        return;
                    }

                    if (eventType && eventType !== 'token') continue;

                    if (FLOWISE_STATUS_STRINGS.has(dataStr)) continue;
                    if (dataStr === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(dataStr);
                        if (parsed.event === 'error') {
                            const errMsg = parsed.data || parsed.message || 'Flowise error';
                            yield { failed: true, errorMessage: errMsg };
                            return;
                        }
                        if (parsed.event && parsed.event !== 'token') continue;
                        const token = parsed.data ?? parsed.token ?? parsed.text ?? null;
                        if (typeof token === 'string' && !FLOWISE_STATUS_STRINGS.has(token)) {
                            yield { chunk: token };
                        }
                    } catch {
                        if (!FLOWISE_STATUS_STRINGS.has(dataStr)) {
                            yield { chunk: dataStr };
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Lỗi khi đọc stream Flowise:', err.message);
            yield { failed: true };
        }
    },

    buildMessagesForAI: async (userId, currentSessionId, processedMessage, cleanBase64ImagesFn) => {
        const [userSessionIds, pastMessages] = await Promise.all([
            chatService.getAllUserSessionIds(userId),
            chatService.getSessionMessages(currentSessionId, userId)
        ]);

        const otherSessionIds = userSessionIds.filter(id => id !== currentSessionId);

        let globalContextStr = "";
        if (otherSessionIds.length > 0){
            const globalMessages = await chatService.getGlobalContextMessages(otherSessionIds,10);
            globalContextStr = globalMessages.reverse().map(m => {
                let safeContent = cleanBase64ImagesFn(m.content);
                if (safeContent && safeContent.length > 500) safeContent = safeContent.substring(0, 500) + '...';
                return `${m.role === 'ai' ? 'AI' : 'User'}: ${safeContent}`; 
            }).join('\n');
        }

        const systemContent = globalContextStr
            ? `Bạn là một trợ lý AI thông minh, nhiệt tình của Neural Hub. Luôn trả lời bằng Tiếng Việt, định dạng văn bản rõ ràng bằng Markdown.\n\nDưới đây là thông tin từ các cuộc trò chuyện ở các phiên khác của người dùng để bạn tham khảo ngữ cảnh (Ký ức dài hạn):\n"""\n${globalContextStr}\n"""`
            : 'Bạn là một trợ lý AI thông minh, nhiệt tình của Neural Hub. Luôn trả lời bằng Tiếng Việt, định dạng văn bản rõ ràng bằng Markdown.';

        const messageForAI = [
            { role: 'system', content: systemContent},
            ...pastMessages.slice(-20).map(m => ({
                role: m.role === 'ai' ? 'assistant' : 'user',
                content: cleanBase64ImagesFn(m.content)
            }))
        ];

        if (messageForAI.length > 0 && messageForAI[messageForAI.length - 1].role === 'user'){
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
            if (files && files.length > 0){
                const processFilterPromises = files.map(async(file) => {
                    let localBase64Data = null;
                    let fileExtractedText = '';
                    let fileFlowiseUpload = null;
                    let replacement = null;

                    const safeName = file.originalname.replace(/[\\]/g, '_');
                    if (file.mimetype.startsWith('image/')) {
                        const fileData = fs.readFileSync(file.path);
                        localBase64Data = fileData.toString('base64');
                        const ext = require('path').extname(file.originalname) || '.png';
                        
                        const crypto = require('crypto');
                        const hash = crypto.createHash('md5').update(fileData).digest('hex');
                        const newFilename = `${hash}${ext}`;
                        const newPath = require('path').join(require('path').dirname(file.path), newFilename);

                        if (fs.existsSync(newPath)) {
                            fs.unlinkSync(file.path);
                            file.path = newPath;
                        } else {
                            fs.renameSync(file.path, newPath);
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

                    if (model === "Data Analyst") {
                        if (!localBase64Data) {
                            const fileData = fs.readFileSync(file.path);
                            localBase64Data = fileData.toString('base64');
                        }
                        fileFlowiseUpload = {
                            data: `data:${file.mimetype};base64,${localBase64Data}`,
                            type: 'file',
                            name: file.originalname,
                            mime: file.mimetype
                        };
                        if (!file.mimetype.startsWith('image/')) {
                            fs.unlinkSync(file.path);
                        }
                    } else {
                        const fileContent = await aiService.extractFileContent(file);
                        fileExtractedText = `\n--- Tài liệu: ${file.originalname} ---\n${fileContent}\n`;
                        if (!file.mimetype.startsWith('image/')) {
                            fs.unlinkSync(file.path);
                        }
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
                    processedMessage = `Người dùng đã tải lên (các) hình ảnh/tài liệu. Hệ thống nhận diện (OCR) đã quét và trích xuất được văn bản sau từ các file đó:\n"""${allExtractedTexts}"""\n\nDựa vào phần chữ đã được hệ thống trích xuất ở trên, hãy trả lời yêu cầu sau của người dùng. Tuyệt đối KHÔNG được từ chối hoặc nói rằng bạn không thể nhìn thấy hình ảnh:\n\nYêu cầu: ${processedMessage}`;
                }

                if (model === "Data Analyst" && flowiseUploads.some(u => u.mime.startsWith('image/'))) {
                    const visionPrompt = `\n\n[HƯỚNG DẪN BẮT BUỘC CHO AI]: Đây là yêu cầu phân tích hình ảnh. Bạn BẮT BUỘC phải: 1. KHÔNG đoán mò, chỉ trả lời dựa trên những gì nhìn thấy rõ. 2. Đọc cẩn thận từng chi tiết, góc cạnh, chữ nhỏ và đường nối (nếu là sơ đồ). 3. Tự rà soát lại (double-check) xem thông tin có khớp với tổng thể ảnh không trước khi trả lời.`;
                    processedMessage = processedMessage + visionPrompt;
                }
            }
        } catch(err) {
            console.error("Lỗi xử lý file đính kèm:", err);
            if (files && files.length > 0) {
                for (const file of files) {
                    if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
                }
            }
            if (err instanceof AppError) throw err;
            throw new AppError('ai.fileReadError', 500);
        }

        return { processedMessage, messageToSave, flowiseUploads };
    },

    getAvailableModels: async (customKey) => {
        try {
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

            return list.data
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
        } catch (error) {
            console.error("Lỗi khi lấy danh sách model từ Groq API:", error.message);
            throw error;
        }
    }
};

module.exports = aiService;
