// New popup.js integrated with PopupManager caching system
class PopupUI {
    constructor() {
        this.statusEl = document.getElementById('status');
        this.logEl = document.getElementById('log');
        this.neuroStatusEl = document.getElementById('neuro-status');
        this.duolingoStatusEl = document.getElementById('duolingo-status');
        this.lastEventEl = document.getElementById('last-event');
        
        // Connection port for receiving messages from background
        this.port = null;
        
        // Initialize UI
        this.initializeConnection();
        this.setupEventListeners();
        this.updateStatus({
            neuroConnected: false,
            duolingoActive: false,
            lastEventTime: null,
            lastEventType: 'None'
        });
    }

    initializeConnection() {
        // Connect to background script using the PopupManager protocol
        this.port = chrome.runtime.connect({ name: 'popup' });
        
        // Listen for messages from PopupManager
        this.port.onMessage.addListener((message) => {
            this.handleMessage(message);
        });

        this.port.onDisconnect.addListener(() => {
            console.log('Disconnected from background script');
        });

        // Also listen for direct runtime messages (fallback)
        chrome.runtime.onMessage.addListener((message) => {
            this.handleMessage(message);
        });
    }

    setupEventListeners() {
        // Add any popup-specific event listeners here
        // For example, clear log button, settings, etc.
    }

    handleMessage(message) {
        switch (message.type) {
            case 'status_update':
                this.updateStatus(message.data);
                break;
            case 'cached_log':
                this.addLogEntry(message.data, true); // true = from cache
                break;
            case 'new_log':
                this.addLogEntry(message.data, false); // false = live log
                break;
            default:
                console.log('Unknown message type:', message.type);
        }
    }

    updateStatus(statusData) {
        const { neuroConnected, duolingoActive, lastEventTime, lastEventType } = statusData;
        
        // Update main status message
        if (neuroConnected && duolingoActive) {
            this.statusEl.textContent = 'Extension Active';
            this.statusEl.className = 'status connected';
        } else if (!neuroConnected && !duolingoActive) {
            this.statusEl.textContent = 'Extension Inactive';
            this.statusEl.className = 'status disconnected';
        } else {
            this.statusEl.textContent = 'Partially Connected';
            this.statusEl.className = 'status unknown';
        }
        
        // Update component statuses
        this.neuroStatusEl.textContent = neuroConnected ? 'Connected' : 'Disconnected';
        this.neuroStatusEl.className = neuroConnected ? 'connected' : 'disconnected';
        
        this.duolingoStatusEl.textContent = duolingoActive ? 'Active' : 'Not Detected';
        this.duolingoStatusEl.className = duolingoActive ? 'connected' : 'unknown';
        
        // Update last event
        if (lastEventTime) {
            const eventTime = new Date(lastEventTime);
            this.lastEventEl.textContent = `${lastEventType} (${eventTime.toLocaleTimeString()})`;
        } else {
            this.lastEventEl.textContent = 'None';
        }
    }

    addLogEntry(logData, isFromCache = false) {
        const div = document.createElement('div');
        const timestamp = new Date(logData.timestamp);
        
        // Apply appropriate CSS class based on log level
        div.className = `log-entry log-${logData.level}`;
        
        // Add cache indicator if this is from cache
        const cacheIndicator = isFromCache ? '[CACHED] ' : '';
        
        // Format the message
        let message = `[${timestamp.toLocaleTimeString()}] ${cacheIndicator}${logData.message}`;
        
        // Add data if present
        if (logData.data && Object.keys(logData.data).length > 0) {
            // Format data nicely for display
            const dataStr = this.formatLogData(logData.data);
            if (dataStr) {
                message += ` | ${dataStr}`;
            }
        }
        
        // Add source indicator for easier debugging
        if (logData.source && logData.source !== 'system') {
            message += ` [${logData.source.toUpperCase()}]`;
        }
        
        div.textContent = message;
        this.logEl.appendChild(div);
        this.logEl.scrollTop = this.logEl.scrollHeight;
        
        // Keep log size manageable (limit to 100 visible entries)
        while (this.logEl.childNodes.length > 100) {
            this.logEl.removeChild(this.logEl.firstChild);
        }
    }

    formatLogData(data) {
        if (!data) return '';
        
        // Handle different types of data objects
        if (typeof data === 'string') {
            return data;
        }
        
        if (typeof data === 'object') {
            // Special formatting for common data types
            if (data.id) {
                return `ID: ${data.id}`;
            }
            if (data.success !== undefined) {
                return `Success: ${data.success}`;
            }
            if (data.message) {
                return data.message;
            }
            if (data.challengeType) {
                return `Type: ${data.challengeType}`;
            }
            
            // Fallback to JSON with truncation for long objects
            const jsonStr = JSON.stringify(data);
            return jsonStr.length > 100 ? jsonStr.substring(0, 100) + '...' : jsonStr;
        }
        
        return String(data);
    }

    // Helper method to manually add a log entry (for debugging)
    addManualLog(message, level = 'info') {
        this.addLogEntry({
            timestamp: new Date().toISOString(),
            level: level,
            message: message,
            source: 'popup'
        }, false);
    }

    // Clear log display (but doesn't affect cache)
    clearLogDisplay() {
        this.logEl.innerHTML = '';
        this.addManualLog('Log display cleared', 'info');
    }
}

// Initialize popup UI when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const popupUI = new PopupUI();
    
    // Make it globally available for debugging
    window.popupUI = popupUI;
    
    // Initial log
    popupUI.addManualLog('Popup loaded and connected to PopupManager', 'info');
});
