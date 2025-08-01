// src/neuro-connection.js
// WebSocket connection management for Neuro API

import { CONFIG, NOTIFICATION_IDS } from './config.js';
import { Logger } from './logger.js';

export class NeuroConnection {
    constructor(popupManager = null) {
        this.ws = null;
        this.isConnected = false;
        this.lastMessageTime = null;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.connectionLost = false;
        this.heartbeatInterval = null;
        this.popupManager = popupManager;
    }

    connect() {
        try {
            Logger.info('Attempting to connect to Neuro API...');
            this.ws = new WebSocket(CONFIG.NEURO_WS_URL);
            this.setupEventHandlers();
        } catch (error) {
            Logger.error('Error connecting to WebSocket:', error);
            this.scheduleReconnect();
        }
    }

    setupEventHandlers() {
        this.ws.onopen = () => this.handleOpen();
        this.ws.onclose = () => this.handleClose();
        this.ws.onerror = (error) => this.handleError(error);
        this.ws.onmessage = (event) => this.handleMessage(event);
    }    handleOpen() {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.connectionLost = false;
        this.lastMessageTime = Date.now();
        
        Logger.info('Connected to Neuro API');
        if (this.popupManager) {
            this.popupManager.logNeuroConnection(true);
        }
        
        this.sendStartup();
        Logger.broadcastConnectionStatus(true);
        
        if (this.reconnectAttempts > 1) {
            this.showReconnectionNotification();
        }

        this.startHeartbeat();
    }    handleClose() {
        const wasConnected = this.isConnected;
        this.isConnected = false;
        this.stopHeartbeat();
        
        if (wasConnected) {
            Logger.warn('Disconnected from Neuro API');
            if (this.popupManager) {
                this.popupManager.logNeuroConnection(false);
            }
            
            if (!this.connectionLost && this.reconnectAttempts >= CONFIG.MAX_RECONNECT_ATTEMPTS) {
                this.connectionLost = true;
                Logger.broadcastConnectionStatus(false);
                this.showDisconnectionNotification();
            } else if (wasConnected) {
                Logger.broadcastConnectionStatus(false, false);
            }
        }
        
        this.scheduleReconnect();
    }    handleError(error) {
        Logger.error('WebSocket error:', error);
        if (this.popupManager) {
            this.popupManager.logError('WebSocket error', { error: error.message || error.toString() });
        }
    }handleMessage(event) {
        try {
            this.lastMessageTime = Date.now();
            const msg = JSON.parse(event.data);
            
            Logger.info(`Received ${msg.command} from Neuro`, msg.data);
            
            // Store the message for processing by the main background script
            this.pendingMessage = { msg, connection: this };
            
            // Dispatch a custom event to notify the main script
            self.dispatchEvent(new CustomEvent('neuro-message', { 
                detail: { msg, connection: this } 
            }));
        } catch (e) {
            Logger.error('Error processing WebSocket message:', e);
        }
    }

    scheduleReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        
        this.reconnectAttempts++;
        const delay = Math.min(
            CONFIG.MAX_RECONNECT_INTERVAL, 
            CONFIG.RECONNECT_INTERVAL * Math.pow(1.5, Math.min(this.reconnectAttempts - 1, 8))
        );
        
        Logger.info(`Will attempt to reconnect in ${Math.round(delay/1000)} seconds (attempt ${this.reconnectAttempts})`);
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
    }

    sendStartup() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const msg = {
                command: 'startup', 
                game: CONFIG.GAME_NAME
            };
            this.ws.send(JSON.stringify(msg));
            Logger.info('Sent startup message to Neuro');
        } else {
            Logger.warn('Cannot send startup message - WebSocket not ready');
        }
    }

    sendToNeuro(msg) {
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            if (!msg.command) {
                Logger.error('Invalid message format: missing command', msg);
                return false;
            }
            if (!msg.game) {
                msg.game = CONFIG.GAME_NAME;
            }
            
            this.ws.send(JSON.stringify(msg));
            Logger.info(`Sent ${msg.command} to Neuro`, msg.data);
            return true;
        } else {
            Logger.warn('Cannot send message, not connected to Neuro API', msg);
            return false;
        }
    }

    startHeartbeat() {
        this.stopHeartbeat(); // Clear any existing interval
        
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                const now = Date.now();
                const timeSinceLastMessage = this.lastMessageTime ? (now - this.lastMessageTime) : 0;
                
                if (timeSinceLastMessage > CONFIG.HEARTBEAT_INTERVAL) {
                    try {
                        this.ws.send(JSON.stringify({
                            command: 'ping',
                            game: CONFIG.GAME_NAME
                        }));
                        Logger.debug('Sent ping to keep WebSocket connection alive');
                    } catch (e) {
                        Logger.warn('Failed to send ping:', e);
                    }
                }
            }
        }, CONFIG.HEARTBEAT_INTERVAL);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    showReconnectionNotification() {
        chrome.notifications.create(NOTIFICATION_IDS.RECONNECT, {
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Neuro Connected',
            message: 'Connection to Neuro API has been restored.',
            priority: 1
        });
    }

    showDisconnectionNotification() {
        chrome.notifications.create(NOTIFICATION_IDS.DISCONNECT, {
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Neuro Connection Lost',
            message: 'Connection to Neuro API has been lost. Will continue trying to reconnect in background.',
            priority: 1
        });
    }

    disconnect() {
        this.stopHeartbeat();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }
}
