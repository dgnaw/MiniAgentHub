export const createSSEHandlers = (context) => {
    const {
        originalSessionId,
        newSessionIdRef, 
        currentMessages,
        aiTextRef,
        isAiMessageAddedRef,
        isStoppedRef,
        isDoneRef,
        isUnmountedRef,
        currentSessionIdRef,
        setMessages,
        setActiveSessionId,
        setIsFlowiseAvailable,
        onNewSession,
        backgroundStreams
    } = context;

    return {
        'session': (data) => {
            const newSessionId = data.sessionId || data; 
            newSessionIdRef.current = newSessionId;
            setActiveSessionId(newSessionId);
            if (onNewSession) onNewSession(newSessionId);
        },

        'chunk': async (data) => {
            if (!isAiMessageAddedRef.current) {
                currentMessages.push({ role: 'ai', content: '' });
                isAiMessageAddedRef.current = true;
            }

            const chunkContent = typeof data === 'string' ? data : (data.content || data.chunk || '');
            const words = chunkContent.match(/\S+|\s+/g) || [];
            
            for (const word of words) {
                if (isStoppedRef.current || isDoneRef.current) break;

                aiTextRef.current += word;
                currentMessages[currentMessages.length - 1] = {
                    ...currentMessages[currentMessages.length - 1],
                    content: aiTextRef.current
                };
                
                const currentNewSessionId = newSessionIdRef.current;
                const isActive = !isUnmountedRef.current && (currentSessionIdRef.current === originalSessionId || currentSessionIdRef.current === currentNewSessionId);
                
                const targetSessionId = currentNewSessionId || originalSessionId;
                if (targetSessionId) {
                    backgroundStreams.set(targetSessionId, currentMessages);
                }

                if (isActive) {
                    setMessages([...currentMessages]);
                }

                const delayTime = 5;
                await new Promise(resolve => setTimeout(resolve, delayTime));
            }
        },

        'warning': (data) => {
            if (data.code === 'FLOWISE_UNAVAILABLE') {
                setIsFlowiseAvailable(false);
            }
        },

        'error': (data) => {
            const errorMsg = typeof data === 'string' ? data : (data.message || 'Unknown error');
            throw new Error(errorMsg);
        }
    };
};

export const dispatchSSEEvent = async (type, data, handlers) => {
    const handler = handlers[type];
    if (handler) {
        await handler(data);
    } else {
        console.warn(`[SSE] Skipping unknown event: ${type}`);
    }
};