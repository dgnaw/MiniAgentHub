const { createParser } = require('eventsource-parser');

const flowiseStrategy = async function* (params) {
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
        console.error('Lỗi kết nối Flowise:', err.message);
        yield { error: 'Hệ thống Data Analyst hiện đang gặp sự cố hoặc quá tải. Vui lòng thử lại sau.' };
        return;
    }

    if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        console.error('Flowise trả về lỗi HTTP:', response.status, errBody.substring(0, 200));
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
        } catch {
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
                    } catch {
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
                        streamFailed = true;
                        continue;
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
            
            parsedEvents = [];
            
            if (streamFailed) {
                yield { error: errorMessage };
                return;
            }
        }
    } catch (err) {
        console.error('Lỗi khi đọc stream Flowise:', err.message);
        yield { error: 'Hệ thống Data Analyst hiện đang gặp sự cố hoặc quá tải. Vui lòng thử lại sau.' };
    }
};

module.exports = flowiseStrategy;
