const aiService = require('../aiService');

const groqStrategy = {
    generateStream: async function* (params) {
        const { userId, currentSessionId, processedMessage, cleanBase64Images, model, customGroqKey, t } = params;
    
    try {
        const messagesForAI = await aiService.buildMessagesForAI(userId, currentSessionId, processedMessage, cleanBase64Images);
        const stream = await aiService.chatWithAIStream(messagesForAI, model, customGroqKey);
        
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
                yield { chunk: content };
            }
        }
    } catch (groqError) {
        console.error('Error calling Groq (Strategy):', groqError.message);
        let errMsg;
        if (groqError.message?.includes('API Key') || groqError.status === 401) {
            errMsg = t ? t('ai.apiKeyInvalid') : 'API Key không hợp lệ.';
        } else {
            errMsg = t ? `${t('server.internalError')}: ${groqError.message || 'Không thể kết nối tới AI.'}` : `Lỗi hệ thống: ${groqError.message || 'Không thể kết nối tới AI.'}`;
        }
        yield { error: errMsg };
    }
},
    
    processAttachment: async (file, localBase64Data) => {
        const fileContent = await aiService.extractFileContent(file);
        const fileExtractedText = `\n--- Tài liệu: ${file.originalname} ---\n${fileContent}\n`;
        return { fileExtractedText };
    }
};

module.exports = groqStrategy;
