const EventEmitter = require('events');

class StreamManager {
    constructor() {
        this.activeStreams = new Map();
    }

    addStream(sessionId) {
        if (!this.activeStreams.has(sessionId)) {
            this.activeStreams.set(sessionId, {
                emitter: new EventEmitter(),
                fullText: '',
                isDone: false,
                isStopped: false,
                error: null,
                newSessionId: null
            });
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
            streamData.fullText += chunk;
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
        }
    }

    markAsStopped(sessionId) {
        const streamData = this.getStream(sessionId);
        if (streamData) {
            streamData.isStopped = true;
        }
    }
}

module.exports = new StreamManager();
