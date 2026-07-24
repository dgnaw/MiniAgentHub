const EventEmitter = require('events');
const redisClient = require('../config/redis');

class StreamManager {
    constructor() {
        this.activeStreams = new Map();
    }

    addStream(sessionId) {
        if (!this.activeStreams.has(sessionId)) {
            const emitter = new EventEmitter();
            emitter.on('error', () => {});  
            this.activeStreams.set(sessionId, {
                emitter: emitter,
                fullText: '', // Khôi phục lại biến in-memory để làm fallback
                isDone: false,
                isStopped: false,
                error: null,
                newSessionId: null
            });
            
            if (redisClient.set) {
                redisClient.set(`stream:${sessionId}`, '', 'EX', 10 * 60).catch(() => {});
            }
            
            setTimeout(() => this.removeStream(sessionId), 10 * 60 * 1000);
        }
    }

    getStream(sessionId) {
        return this.activeStreams.get(sessionId);
    }

    setNewSessionId(sessionId, newSessionId) {
        const streamData = this.getStream(sessionId);
        if (streamData) {
            streamData.newSessionId = newSessionId;
        }
    }

    emitChunk(sessionId, chunk) {
        const streamData = this.getStream(sessionId);
        if (streamData && !streamData.isDone) {
            streamData.fullText += chunk; // Luôn lưu in-memory làm fallback
            if (redisClient.append) {
                redisClient.append(`stream:${sessionId}`, chunk).catch(() => {});
            }
            streamData.emitter.emit('chunk', chunk);
        }
    }

    emitFlowiseUnavailable(sessionId) {
        const streamData = this.getStream(sessionId);
        if (streamData && !streamData.isDone) {
            streamData.emitter.emit('flowiseUnavailable');
        }
    }

    emitError(sessionId, errorMsg) {
        const streamData = this.getStream(sessionId);
        if (streamData && !streamData.isDone) {
            streamData.error = errorMsg;
            streamData.isDone = true;
            streamData.emitter.emit('error', errorMsg);
        }
    }

    emitDone(sessionId) {
        const streamData = this.getStream(sessionId);
        if (streamData && !streamData.isDone) {
            streamData.isDone = true;
            streamData.emitter.emit('done');
        }
    }

    removeStream(sessionId) {
        const streamData = this.getStream(sessionId);
        if (streamData) {
            streamData.emitter.removeAllListeners();
            this.activeStreams.delete(sessionId);
            if (redisClient.del) {
                redisClient.del(`stream:${sessionId}`).catch(() => {});
            }
        }
    }

    markAsStopped(sessionId) {
        const streamData = this.getStream(sessionId);
        if (streamData) {
            streamData.isStopped = true;
        }
    }
    
    async getFullText(sessionId) {
        if (redisClient.get) {
            try {
                const text = await redisClient.get(`stream:${sessionId}`);
                return text || '';
            } catch (err) {
                return this.activeStreams.get(sessionId)?.fullText || '';
            }
        }
        return this.activeStreams.get(sessionId)?.fullText || '';
    }
}

module.exports = new StreamManager();
