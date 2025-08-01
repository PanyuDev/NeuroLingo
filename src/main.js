// src/main.js (formerly content.js)

console.log('Neuro-Duolingo main.js loaded');
logToPopup('info', 'Main content script loaded and initialized');

// Track the last question to avoid duplicate messages
let lastQuestionHash = '';
let lastContextSentTime = 0;
let lastActionRegistrationTime = 0;
let lastAnswerSubmittedTime = 0; // Track when an answer was last submitted
const DEBOUNCE_DELAY = 1000; // Minimum delay between context messages in ms
const CONTEXT_CHANGE_THRESHOLD = 5000; // Don't send similar context within 5 seconds
const ACTION_REGISTRATION_THRESHOLD = 10000; // Don't register actions more often than every 10 seconds
const ANSWER_COOLDOWN_PERIOD = 3000; // Wait 3 seconds after answer submission before sending new context

// Send context to Neuro when events happen in Duolingo
function sendContext(message, silent = false) {
    try {
        // Following API.md specification for context command
        chrome.runtime.sendMessage({
            type: 'neuro_context',
            data: {
                message: message, // A plaintext message describing what is happening
                silent: silent || false // If true, message is added without prompting Neuro to respond
            }
        }).catch(error => {
            console.debug('Error sending context to background script:', error);
        });
    } catch (error) {
        console.debug('Failed to send context message:', error);
    }
}

// Logging function that sends to background for popup display
function logToPopup(level, message, data = null) {
    try {
        chrome.runtime.sendMessage({
            type: 'neuro_log',
            data: {
                message: `[Content] ${message}`,
                level: level,
                timestamp: new Date().toISOString(),
                data: data
            }
        }).catch(() => {
            // Ignore errors when background script is not available
        });
    } catch (error) {
        // Ignore errors
    }
}

// Function to update the last answer submitted time (called from actions.js)
function updateLastAnswerSubmittedTime() {
    lastAnswerSubmittedTime = Date.now();
    logToPopup('debug', 'Updated last answer submitted time');
}

// Listen for messages from the background script (e.g., to execute an action)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', request);
    logToPopup('debug', `Received message type: ${request.type}`);
    
    if (request.type === 'neuro_action' && request.data) {
        const { id, name, data } = request.data;
        
        console.log('Executing action:', name, 'with data:', data, 'and id:', id);
        logToPopup('info', `Executing action: ${name}`, { id, data });
        
        // Parse the data string if it's a JSON string
        let parameters = data;
        if (typeof data === 'string') {
            try {
                parameters = JSON.parse(data);
                console.log('Parsed parameters:', parameters);
                logToPopup('debug', 'Successfully parsed action parameters');
            } catch (error) {
                console.error('Failed to parse action data:', error, data);
                logToPopup('error', 'Failed to parse action data', { error: error.message, data });
                // Send error result back to Neuro
                chrome.runtime.sendMessage({
                    type: 'neuro_action_result',
                    data: {
                        id: id,
                        success: false,
                        message: 'Failed to parse action data'
                    }
                }).catch(() => {});
                return;
            }
        }
          // Route the action to the appropriate handler
        switch (name) {
            case 'submit_answer':
                submit_answer(parameters, id);
                break;
            case 'get_question_context':
                get_question_context(id);
                break;
            case 'continue_lesson':
                continue_lesson(id);
                break;
        }
    }
});

// Main observer loop to detect changes in the Duolingo interface
const observer = new MutationObserver((mutations) => {
    // Use a timeout to debounce the handler
    setTimeout(() => {
        const context = extractQuestionContext();
        
        // If there's no question, it might be a transition screen
        if (!context.question) {
            // Try to register actions if they haven't been recently
            registerActions();
            return;
        }
          // Create a simple hash of the context to detect changes
        const currentHash = JSON.stringify(context);
        
        // If the question context has changed, send it to Neuro
        if (currentHash !== lastQuestionHash) {
            const now = Date.now();
            
            // Check if we recently submitted an answer
            if (lastAnswerSubmittedTime && (now - lastAnswerSubmittedTime < ANSWER_COOLDOWN_PERIOD)) {
                logToPopup('debug', `Delaying context send - answer was recently submitted ${now - lastAnswerSubmittedTime}ms ago`);
                return;
            }
            
            if (now - lastContextSentTime > CONTEXT_CHANGE_THRESHOLD) {
                lastQuestionHash = currentHash;
                lastContextSentTime = now;
                  // Construct a descriptive message for Neuro
                let message = `New question: ${context.question}`;
                
                if (context.contextType === 'choice') {
                    // Format options clearly with numbers
                    const formattedOptions = context.options.map((option, index) => 
                        `${index + 1}. ${option.text.replace(/\n\d+$/, '').trim()}`
                    ).join('\n');
                    message += `\nOptions:\n${formattedOptions}`;
                } else if (context.contextType === 'tap') {
                    // For tap challenges, list available tokens
                    const formattedTokens = context.tokens.map((token, index) => 
                        `${index + 1}. ${token.trim()}`
                    ).join('\n');
                    message += `\nAvailable words:\n${formattedTokens}`;
                } else if (context.contextType === 'text') {
                    message += `\nType your answer in the text field.`;
                }
                
                // Add instruction for audio questions
                if (context.question.toLowerCase().includes('what do you hear') || 
                    context.question.toLowerCase().includes('listen') ||
                    document.querySelector('[data-test="player-button"]')) {
                    message += `\nThis is an audio question. Listen to the audio and select the correct option.`;
                }
                
                logToPopup('info', `New ${context.contextType} question detected`, { question: context.question });
                sendContext(message);
                registerActions(); // Re-register actions for the new context
            }
        }
    }, DEBOUNCE_DELAY);
});

// Start observing the document body for changes
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Initial registration of actions when the script loads
registerActions();
