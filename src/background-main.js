// src/background-main.js
// Main background script that initializes and coordinates all modules

import { Logger } from './logger.js';
import { NeuroConnection } from './neuro-connection.js';
import { MessageHandler } from './message-handler.js';

// Import PopupManager - note: can't use ES6 import for classes in service workers yet
// So we'll include it inline or use a different approach

class BackgroundService {
    constructor() {
        this.popupManager = this.createPopupManager();
        this.connection = new NeuroConnection(this.popupManager);
        this.setupMessageListeners();
        this.initialize();
    }

    createPopupManager() {
        // Since we can't import the class directly in service workers,
        // we'll create a simplified version here that matches the interface
        return {
            logCache: [],
            statusCache: {
                neuroConnected: false,
                duolingoActive: false,
                lastEventTime: null,
                lastEventType: 'None'
            },
            maxCacheSize: 200,
            isPopupOpen: false,
            popupPorts: new Set(),

            // Setup popup connection listeners
            setupPopupListeners: function() {
                chrome.runtime.onConnect.addListener((port) => {
                    if (port.name === 'popup') {
                        this.isPopupOpen = true;
                        this.popupPorts.add(port);
                        console.log('Popup opened');
                        
                        // Send cached data to newly opened popup
                        this.sendCachedData(port);
                        
                        port.onDisconnect.addListener(() => {
                            this.popupPorts.delete(port);
                            this.isPopupOpen = this.popupPorts.size > 0;
                            console.log('Popup closed');
                        });
                    }
                });
            },

            sendCachedData: function(port) {
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
            },

            addLogEntry: function(logData) {
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
            },

            updateStatus: function(statusUpdate) {
                // Update cached status
                Object.assign(this.statusCache, statusUpdate);

                // If popup is open, broadcast update
                if (this.isPopupOpen) {
                    this.broadcastToPopup({
                        type: 'status_update',
                        data: this.statusCache
                    });
                }
            },

            updateLastEvent: function(eventType, eventTime = new Date()) {
                this.statusCache.lastEventTime = eventTime.toISOString();
                this.statusCache.lastEventType = eventType;

                if (this.isPopupOpen) {
                    this.broadcastToPopup({
                        type: 'status_update',
                        data: this.statusCache
                    });
                }
            },

            broadcastToPopup: function(message) {
                // Send message to all popup connections
                this.popupPorts.forEach(port => {
                    try {
                        port.postMessage(message);
                    } catch (error) {
                        console.warn('Failed to send message to popup port:', error);
                        this.popupPorts.delete(port);
                    }
                });
            },

            // Convenience logging methods
            logInfo: function(message, data = null) {
                return this.addLogEntry({
                    level: 'info',
                    message,
                    data,
                    source: 'system'
                });
            },

            logWarn: function(message, data = null) {
                return this.addLogEntry({
                    level: 'warn',
                    message,
                    data,
                    source: 'system'
                });
            },            logError: function(message, data = null) {
                return this.addLogEntry({
                    level: 'error',
                    message,
                    data,
                    source: 'system'
                });
            },

            logDebug: function(message, data = null) {
                return this.addLogEntry({
                    level: 'debug',
                    message,
                    data,
                    source: 'system'
                });
            },

            logNeuroConnection: function(connected) {
                this.statusCache.neuroConnected = connected;
                this.addLogEntry({
                    level: connected ? 'info' : 'warn',
                    message: `Neuro connection: ${connected ? 'Connected' : 'Disconnected'}`,
                    source: 'neuro'
                });
                this.updateLastEvent(`Neuro ${connected ? 'Connected' : 'Disconnected'}`);
            },

            logDuolingoActivity: function(active) {
                this.statusCache.duolingoActive = active;
                this.addLogEntry({
                    level: 'info',
                    message: `Duolingo: ${active ? 'Active' : 'Not Detected'}`,
                    source: 'duolingo'
                });
            },

            logContext: function(contextData, challengeType = 'Unknown') {
                this.addLogEntry({
                    level: 'info',
                    message: `Context extracted - ${challengeType}`,
                    data: contextData,
                    source: 'context'
                });
                this.updateLastEvent(`Context (${challengeType})`);
            },

            logActionResult: function(resultData) {
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
        };
    }

    initialize() {
        Logger.info('Background service initializing...');
        this.popupManager.setupPopupListeners();
        this.popupManager.logInfo('Background service initializing...');
        
        this.connection.connect();
        
        Logger.info('Background service initialized');
        this.popupManager.logInfo('Background service initialized');
    }    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            // Log incoming messages through PopupManager
            this.popupManager.logInfo(`Received message: ${message.type}`, { message, senderId: sender.id });
            return MessageHandler.handleRuntimeMessage(message, sender, sendResponse, this.connection, this.popupManager);
        });

        // Handle messages from the WebSocket connection
        self.addEventListener('neuro-message', (event) => {
            const { msg, connection } = event.detail;
            this.popupManager.logInfo('Processing Neuro message', { messageType: msg.type });
            MessageHandler.process(msg, connection, this.popupManager);
        });

        // Handle extension lifecycle events
        chrome.runtime.onStartup.addListener(() => {
            Logger.info('Extension startup detected');
            this.popupManager.logInfo('Extension startup detected');
            this.initialize();
        });

        chrome.runtime.onInstalled.addListener((details) => {
            Logger.info(`Extension installed/updated: ${details.reason}`);
            this.popupManager.logInfo(`Extension installed/updated: ${details.reason}`);
            if (details.reason === 'install') {
                this.showWelcomeNotification();
            }
        });        // Handle tab updates to detect when user navigates to/from Duolingo
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url && tab.url.includes('duolingo.com')) {
                Logger.info(`Duolingo tab loaded: ${tab.url}`);
                this.popupManager.logDuolingoActivity(true);
                
                // Optionally register actions when a Duolingo tab loads
                setTimeout(() => {
                    chrome.tabs.sendMessage(tabId, { type: 'duolingo_tab_ready' }).catch(() => {
                        // Ignore errors if content script isn't ready yet
                    });
                }, 1000);
            }
        });

        // Note: Connection status monitoring is handled within the NeuroConnection class
        // through the Logger.broadcastConnectionStatus() calls rather than events
    }

    showWelcomeNotification() {
        chrome.notifications.create('welcome', {
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Neuro-Duolingo Extension Installed',
            message: 'Ready to connect to Neuro API for automated Duolingo assistance!',
            priority: 1
        });
    }    shutdown() {
        Logger.info('Background service shutting down...');
        this.popupManager.logWarn('Background service shutting down...');
        this.connection.disconnect();
    }
}

// Initialize the background service
const backgroundService = new BackgroundService();

// Handle extension unload
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onSuspend) {
    chrome.runtime.onSuspend.addListener(() => {
        backgroundService.shutdown();
    });
}
