// Manages popup state and internal log caching when popup is closed

class PopupManager {
    constructor() {
        this.logCache = [];
        this.statusCache = {
            neuroConnected: false,
            duolingoActive: false,
            lastEventTime: null,
            lastEventType: 'None'
        };
        this.maxCacheSize = 200; // Store up to 200 log entries
        this.isPopupOpen = false;
        
        // Listen for popup open/close
        this.setupPopupListeners();
    }

    setupPopupListeners() {
        // Track when popup opens
        chrome.runtime.onConnect.addListener((port) => {
            if (port.name === 'popup') {
                this.isPopupOpen = true;
                console.log('Popup opened');
                
                // Send cached logs to newly opened popup
                this.sendCachedData(port);
                
                port.onDisconnect.addListener(() => {
                    this.isPopupOpen = false;
                    console.log('Popup closed');
                });
            }
        });
    }

    sendCachedData(port) {
        // Send current status
        port.postMessage({
            type: 'status_update',
            data: this.statusCache
        });

        // Send all cached log entries
        this.logCache.forEach(logEntry => {
            port.postMessage({
                type: 'cached_log',
                data: logEntry
            });
        });
    }

    addLogEntry(logData) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: logData.level || 'info',
            message: logData.message,
            data: logData.data,
            source: logData.source || 'system'
        };

        // Add to cache
        this.logCache.push(logEntry);

        // Trim cache if it exceeds max size
        if (this.logCache.length > this.maxCacheSize) {
            this.logCache = this.logCache.slice(-this.maxCacheSize);
        }

        // If popup is open, send immediately
        if (this.isPopupOpen) {
            this.broadcastToPopup({
                type: 'new_log',
                data: logEntry
            });
        }

        return logEntry;
    }

    updateStatus(statusUpdate) {
        // Update cached status
        Object.assign(this.statusCache, statusUpdate);

        // If popup is open, broadcast update
        if (this.isPopupOpen) {
            this.broadcastToPopup({
                type: 'status_update',
                data: this.statusCache
            });
        }
    }

    updateLastEvent(eventType, eventTime = new Date()) {
        this.statusCache.lastEventTime = eventTime.toISOString();
        this.statusCache.lastEventType = eventType;

        if (this.isPopupOpen) {
            this.broadcastToPopup({
                type: 'status_update',
                data: this.statusCache
            });
        }
    }

    broadcastToPopup(message) {
        // Send message to all popup connections
        try {
            chrome.runtime.sendMessage(message);
        } catch (error) {
            console.warn('Failed to send message to popup:', error);
        }
    }

    // Helper methods for different log types
    logInfo(message, data = null) {
        return this.addLogEntry({
            level: 'info',
            message,
            data,
            source: 'system'
        });
    }

    logWarn(message, data = null) {
        return this.addLogEntry({
            level: 'warn',
            message,
            data,
            source: 'system'
        });
    }

    logError(message, data = null) {
        return this.addLogEntry({
            level: 'error',
            message,
            data,
            source: 'system'
        });
    }

    logDebug(message, data = null) {
        return this.addLogEntry({
            level: 'debug',
            message,
            data,
            source: 'system'
        });
    }

    // Specialized logging methods for different contexts
    logNeuroConnection(connected) {
        this.statusCache.neuroConnected = connected;
        this.addLogEntry({
            level: connected ? 'info' : 'warn',
            message: `Neuro connection: ${connected ? 'Connected' : 'Disconnected'}`,
            source: 'neuro'
        });
        this.updateLastEvent(`Neuro ${connected ? 'Connected' : 'Disconnected'}`);
    }

    logDuolingoActivity(active) {
        this.statusCache.duolingoActive = active;
        this.addLogEntry({
            level: 'info',
            message: `Duolingo: ${active ? 'Active' : 'Not Detected'}`,
            source: 'duolingo'
        });
    }

    logContext(contextData, challengeType = 'Unknown') {
        this.addLogEntry({
            level: 'info',
            message: `Context extracted - ${challengeType}`,
            data: contextData,
            source: 'context'
        });
        this.updateLastEvent(`Context (${challengeType})`);
    }

    logActionResult(resultData) {
        const success = resultData.success;
        const status = success ? 'SUCCESS' : 'FAILED';
        
        this.addLogEntry({
            level: success ? 'info' : 'error',
            message: `Action ${status} - ID: ${resultData.id}`,
            data: resultData,
            source: 'action'
        });
        this.updateLastEvent(`Action (${status})`);
    }

    // Get current cache stats for debugging
    getCacheStats() {
        return {
            logCacheSize: this.logCache.length,
            maxCacheSize: this.maxCacheSize,
            isPopupOpen: this.isPopupOpen,
            statusCache: this.statusCache
        };
    }
}

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PopupManager;
} else if (typeof window !== 'undefined') {
    window.PopupManager = PopupManager;
}
