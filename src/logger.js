// src/logger.js
// Logging utility that forwards messages to popup and console

export class Logger {
    static log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        
        // Log to console
        console[level](logMessage, data || '');
        
        // Forward to popup for display
        this.broadcastLog(logMessage, level, data);
    }

    static info(message, data = null) {
        this.log('info', message, data);
    }

    static warn(message, data = null) {
        this.log('warn', message, data);
    }

    static error(message, data = null) {
        this.log('error', message, data);
    }

    static debug(message, data = null) {
        this.log('debug', message, data);
    }

    static broadcastLog(message, level = 'info', data = null) {
        try {
            chrome.runtime.sendMessage({
                type: 'neuro_log',
                data: {
                    message,
                    level,
                    timestamp: new Date().toISOString(),
                    data
                }
            }).catch(() => {
                // Ignore errors when no receivers are available (popup closed)
            });
        } catch (e) {
            console.debug('Could not broadcast log - popup may be closed');
        }
    }

    static broadcastConnectionStatus(connected, showNotification = true) {
        try {
            chrome.runtime.sendMessage({
                type: 'neuro_connection_update',
                data: {
                    connected,
                    timestamp: new Date().toISOString()
                }
            }).catch(() => {
                // Ignore errors when no receivers are available
            });
        } catch (e) {
            console.debug('Could not broadcast connection status - popup may be closed');
        }
    }
}
