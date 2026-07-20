const { createParser } = require('eventsource-parser');
const fsp = require('fs').promises;

const flowiseStrategy = {
    generateStream: async function* (params) {
    const { processedMessage, currentSessionId, flowiseUploads, customFlowiseUrl } = params;
    const flowiseUrl = customFlowiseUrl || process.env.FLOWISE_API_URL;
    
    const payload = {
        question: processedMessage,
        streaming: true,
        overrideConfig: { sessionId: currentSessionId }
    };

    if (flowiseUploads && flowiseUploads.length > 0) {
        payload.uploads = flowiseUploads;
    }

    let response;
    try {
        response = await fetch(flowiseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.error('Error connecting to Flowise:', err.message);
        yield { error: 'Hệ thống Data Analyst hiện đang gặp sự cố hoặc quá tải. Vui lòng thử lại sau.' };
        return;
    }

    if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        console.error('Flowise returned HTTP error:', response.status, errBody.substring(0, 200));
        yield { error: 'Hệ thống Data Analyst hiện đang gặp sự cố hoặc quá tải. Vui lòng thử lại sau.' };
        return;
    }

    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('text/event-stream')) {
        try {
            const rawText = await response.text();
            const json = JSON.parse(rawText);
            const text = json.text || json.answer || json.output || json.result || JSON.stringify(json);
            if (typeof text === 'string' && (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html'))) {
                yield { error: 'Hệ thống Data Analyst hiện đang gặp sự cố hoặc quá tải. Vui lòng thử lại sau.' };
            } else {
                yield { chunk: text };
            }
        } catch (err) {
            console.error('Error parsing Flowise non-stream response:', err.message);
            yield { error: 'Hệ thống Data Analyst hiện đang gặp sự cố hoặc quá tải. Vui lòng thử lại sau.' };
        }
        return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    const FLOWISE_STATUS_STRINGS = new Set([
        'INProgress', 'done', 'start', 'end', 'error',
        '[DONE]', 'true', 'false', 'null', ''
    ]);

    let streamFailed = false;
    let errorMessage = null;
    let parsedEvents = [];

    const parser = createParser({
        onEvent: (event) => {
            parsedEvents.push(event);
        }
    });

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const rawChunk = decoder.decode(value, { stream: true });
            parser.feed(rawChunk);

            for (const event of parsedEvents) {
                if (event.event === 'error') {
                    try {
                        const errParsed = JSON.parse(event.data);
                        errorMessage = errParsed.data || errParsed.message || 'Hệ thống Data Analyst hiện đang gặp sự cố hoặc quá tải. Vui lòng thử lại sau.';
                    } catch (err) {
                        console.error('Error parsing Flowise event string:', err.message);
                        errorMessage = event.data || 'Hệ thống Data Analyst hiện đang gặp sự cố hoặc quá tải. Vui lòng thử lại sau.';
                    }
                    streamFailed = true;
                    continue;
                }

                if (event.event && event.event !== 'token') continue;

                const dataStr = event.data;
                if (!dataStr || FLOWISE_STATUS_STRINGS.has(dataStr) || dataStr === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(dataStr);

                    if (typeof parsed === 'string') {
                        if (!FLOWISE_STATUS_STRINGS.has(parsed)) {
                            yield { chunk: parsed };
                        }
                        continue;
                    }

                    if (parsed.event === 'error') {
                        errorMessage = parsed.data || parsed.message || 'Hệ thống Data Analyst hiện đang gặp sự cố hoặc quá tải. Vui lòng thử lại sau.';
                        console.error('Flowise stream event error:', errorMessage);
                        streamFailed = true;
                        continue;
                    }
                    if (parsed.event && parsed.event !== 'token') continue;
                    const token = parsed.data ?? parsed.token ?? parsed.text ?? null;
                    if (typeof token === 'string' && !FLOWISE_STATUS_STRINGS.has(token)) {
                        yield { chunk: token };
                    }
                } catch (err) {
                    console.debug('Flowise JSON parse failed for stream chunk:', err.message);
                    if (!FLOWISE_STATUS_STRINGS.has(dataStr)) {
                        yield { chunk: dataStr };
                    }
                }
            }
            
            parsedEvents = [];
            
            if (streamFailed) {
                yield { error: errorMessage };
                return;
            }
        }
    } catch (err) {
        console.error('Error reading Flowise stream:', err.message);
        yield { error: 'Hệ thống Data Analyst hiện đang gặp sự cố hoặc quá tải. Vui lòng thử lại sau.' };
    }
},
    
    processAttachment: async (file, localBase64Data) => {
        let base64 = localBase64Data;
        if (!base64) {
            const fileData = await fsp.readFile(file.path);
            base64 = fileData.toString('base64');
        }
        const fileFlowiseUpload = {
            data: `data:${file.mimetype};base64,${base64}`,
            type: 'file',
            name: file.originalname,
            mime: file.mimetype
        };
        return { fileFlowiseUpload };
    }
    
};

module.exports = flowiseStrategy;
