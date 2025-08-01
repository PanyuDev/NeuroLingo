// src/config.js
// Configuration constants for the extension

export const CONFIG = {
    NEURO_WS_URL: 'ws://localhost:8000',
    GAME_NAME: 'Neuro-Duolingo Game',
    RECONNECT_INTERVAL: 10000, // 10 seconds
    MAX_RECONNECT_INTERVAL: 60000, // 1 minute
    MAX_RECONNECT_ATTEMPTS: 5,
    HEARTBEAT_INTERVAL: 15000 // 15 seconds
};

export const NOTIFICATION_IDS = {
    RECONNECT: 'neuro_reconnect',
    DISCONNECT: 'neuro_disconnect'
};
