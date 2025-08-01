// src/message-handler.js
// Handles processing of messages from Neuro API and content scripts

import { CONFIG } from './config.js';
import { Logger } from './logger.js';

export class MessageHandler {
    static process(msg, connection, popupManager = null) {
        try {
            switch (msg.command) {
                case 'action':
                    this.handleAction(msg, connection, popupManager);
                    break;
                case 'status':
                    this.handleStatus(msg, connection, popupManager);
                    break;
                default:
                    Logger.warn(`Unknown command received from Neuro: ${msg.command}`, msg);
                    if (popupManager) {
                        popupManager.logWarn(`Unknown command received from Neuro: ${msg.command}`, { command: msg.command });
                    }
            }
            
            // Log important messages to PopupManager and any open popups
            if (msg.command === 'action' || msg.command === 'status') {
                const logMessage = `Received ${msg.command} from Neuro: ${JSON.stringify(msg.data || {})}`;
                Logger.broadcastLog(logMessage);
                if (popupManager) {
                    popupManager.logInfo(logMessage, { command: msg.command, data: msg.data });
                }
            }
        } catch (e) {
            Logger.error('Error processing message:', e);
            if (popupManager) {
                popupManager.logError('Error processing message', { error: e.message });
            }
        }
    }    static async handleAction(msg, connection, popupManager = null) {
        if (!msg.data || !msg.data.id) {
            Logger.error('Invalid action message: missing data or id', msg);
            if (popupManager) {
                popupManager.logError('Invalid action message: missing data or id', { message: msg });
            }
            return;
        }

        try {
            // Find Duolingo tabs
            const tabs = await chrome.tabs.query({
                url: 'https://www.duolingo.com/*'
            });

            if (tabs.length === 0) {
                Logger.warn('No Duolingo tabs found for action');
                if (popupManager) {
                    popupManager.logWarn('No Duolingo tabs found for action');
                    popupManager.logDuolingoActivity(false);
                }
                connection.sendToNeuro({
                    command: 'action/result',
                    game: CONFIG.GAME_NAME,
                    data: {
                        id: msg.data.id,
                        success: false,
                        message: 'No Duolingo tab is currently open.'
                    }
                });
                return;
            }

            // Forward to all matching tabs
            let messagesSent = 0;
            for (const tab of tabs) {
                try {
                    await chrome.tabs.sendMessage(tab.id, {
                        type: 'neuro_action',
                        data: msg.data
                    });
                    messagesSent++;
                    Logger.debug(`Sent action to tab ${tab.id}`);
                    if (popupManager) {
                        popupManager.logInfo(`Sent action to tab ${tab.id}`, { actionId: msg.data.id, tabId: tab.id });
                    }
                } catch (error) {
                    Logger.warn(`Failed to send message to tab ${tab.id}:`, error);
                    if (popupManager) {
                        popupManager.logWarn(`Failed to send message to tab ${tab.id}`, { error: error.message, tabId: tab.id });
                    }
                }
            }

            if (messagesSent === 0) {
                Logger.error('Failed to send action to any tabs');
                if (popupManager) {
                    popupManager.logError('Failed to send action to any tabs');
                }
                connection.sendToNeuro({
                    command: 'action/result',
                    game: CONFIG.GAME_NAME,
                    data: {
                        id: msg.data.id,
                        success: false,
                        message: 'Failed to communicate with Duolingo tabs.'
                    }
                });
            }
        } catch (error) {
            Logger.error('Error handling action:', error);
            if (popupManager) {
                popupManager.logError('Error handling action', { error: error.message, actionId: msg.data.id });
            }
            connection.sendToNeuro({
                command: 'action/result',
                game: CONFIG.GAME_NAME,
                data: {
                    id: msg.data.id,
                    success: false,
                    message: 'Internal error processing action.'
                }
            });
        }
    }    static handleStatus(msg, connection, popupManager = null) {
        Logger.info('Received status from Neuro', msg.data);
        if (popupManager) {
            popupManager.logInfo('Received status from Neuro', { data: msg.data });
        }
        // Handle status messages if needed
    }

    static handleRuntimeMessage(message, sender, sendResponse, connection, popupManager = null) {
        try {            switch (message.type) {
                case 'neuro_context':
                    this.handleContextMessage(message, connection, popupManager);
                    break;
                case 'neuro_action_result':
                    this.handleActionResult(message, connection, popupManager);
                    break;
                case 'neuro_register_actions':
                    this.handleRegisterActions(message, connection, popupManager);
                    break;
                case 'neuro_force_action':
                    this.handleForceAction(message, connection, popupManager);
                    break;                case 'neuro_log':
                    // Handle log messages from content scripts or other components
                    if (popupManager && message.data) {
                        popupManager.addLogEntry({
                            level: message.data.level || 'info',
                            message: message.data.message || '',
                            data: message.data.data,
                            source: message.data.source || 'content'
                        });
                    }
                    break;
                case 'neuro_connection_update':
                    // Handle connection status updates
                    if (popupManager && message.data) {
                        popupManager.logNeuroConnection(message.data.connected);
                    }
                    break;
                case 'get_neuro_status':
                    sendResponse({ connected: connection.isConnected });
                    return true; // Required for async response
                default:
                    Logger.debug(`Unknown message type: ${message.type}`);
                    if (popupManager) {
                        popupManager.logDebug(`Unknown message type: ${message.type}`, { messageType: message.type });
                    }
            }
        } catch (error) {
            Logger.error('Error handling runtime message:', error);
            if (popupManager) {
                popupManager.logError('Error handling runtime message', { error: error.message, messageType: message.type });
            }
        }

        // Always send a response to avoid "receiving end does not exist" errors
        try {
            sendResponse({ ok: true });
        } catch (e) {
            // Response may have already been sent or the sender is gone
        }

        return false;
    }

    static handleContextMessage(message, connection, popupManager = null) {
        if (!message.data) {
            Logger.error('Invalid context message: missing data', message);
            if (popupManager) {
                popupManager.logError('Invalid context message: missing data');
            }
            return;
        }

        const contextData = {
            message: message.data.message || '',
            silent: message.data.silent || false
        };

        connection.sendToNeuro({
            command: 'context',
            game: CONFIG.GAME_NAME,
            data: contextData
        });

        if (popupManager) {
            // Extract challenge type for better logging
            const challengeType = message.data.challengeType || 'Unknown';
            popupManager.logContext(contextData, challengeType);
        }
    }

    static handleActionResult(message, connection, popupManager = null) {
        if (!message.data || !message.data.id) {
            Logger.error('Invalid action result format:', message);
            if (popupManager) {
                popupManager.logError('Invalid action result format', { message });
            }
            return;
        }

        const resultData = {
            id: message.data.id,
            success: message.data.success || false,
            message: message.data.message || ''
        };

        connection.sendToNeuro({
            command: 'action/result',
            game: CONFIG.GAME_NAME,
            data: resultData
        });

        if (popupManager) {
            popupManager.logActionResult(resultData);
        }
    }    static handleRegisterActions(message, connection, popupManager = null) {
        if (!message.data || !message.data.actions || !Array.isArray(message.data.actions)) {
            Logger.error('Invalid register actions format:', message);
            Logger.broadcastLog('Failed to register actions: invalid format');
            if (popupManager) {
                popupManager.logError('Failed to register actions: invalid format');
            }
            return;
        }

        const success = connection.sendToNeuro({
            command: 'actions/register',
            game: CONFIG.GAME_NAME,
            data: {
                actions: message.data.actions
            }
        });

        if (success) {
            const actionNames = message.data.actions.map(a => a.name).join(', ');
            Logger.info(`Registered ${message.data.actions.length} actions with Neuro: ${actionNames}`);
            Logger.broadcastLog(`Registered ${message.data.actions.length} actions with Neuro: ${actionNames}`);
            if (popupManager) {
                popupManager.logInfo(`Registered ${message.data.actions.length} actions with Neuro`, { actionNames });
                popupManager.updateLastEvent('Actions Registered');
            }
        } else {
            Logger.error('Failed to send action registration to Neuro');
            Logger.broadcastLog('Failed to register actions: connection error');
            if (popupManager) {
                popupManager.logError('Failed to register actions: connection error');
            }
        }
    }

    static handleForceAction(message, connection, popupManager = null) {
        if (!message.data) {
            Logger.error('Invalid force action message: missing data', message);
            if (popupManager) {
                popupManager.logError('Invalid force action message: missing data');
            }
            return;
        }

        const forceData = {
            state: message.data.state || null,
            query: message.data.query || 'Continue to next action',
            ephemeral_context: message.data.ephemeral_context || false,
            action_names: message.data.action_names || []
        };

        const success = connection.sendToNeuro({
            command: 'actions/force',
            game: CONFIG.GAME_NAME,
            data: forceData
        });

        if (success) {
            Logger.info(`Forced Neuro action with query: "${forceData.query}"`);
            if (popupManager) {
                popupManager.logInfo(`Forced Neuro action with query: "${forceData.query}"`, { query: forceData.query });
                popupManager.updateLastEvent('Force Action');
            }
        } else {
            Logger.error('Failed to send force action to Neuro');
            if (popupManager) {
                popupManager.logError('Failed to send force action to Neuro');
            }
        }
    }
}
