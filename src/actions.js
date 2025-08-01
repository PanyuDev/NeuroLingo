// src/actions.js

console.log('Neuro-Duolingo actions.js loaded');

// Register all supported actions according to API.md specification
function registerActions() {
    // Avoid registering actions too frequently
    const now = Date.now();
    if (now - lastActionRegistrationTime < ACTION_REGISTRATION_THRESHOLD) {
        console.debug('Skipping action registration - registered recently');
        logToPopup('debug', 'Skipping action registration - registered recently');
        return;
    }
    
    // Update registration time
    lastActionRegistrationTime = now;
    
    logToPopup('info', 'Registering actions with Neuro API');
    
    const actions = [
        {
            name: 'submit_answer',
            description: 'Submit an answer to the current Duolingo question. For tap challenges, provide a comma-separated list of tokens. For multiple choice, provide the option text. For text input, provide the full text answer.',            schema: {
                type: 'object',
                properties: {
                    answer: {type: 'string'}
                },
                required: ['answer']
            }
        },
        {
            name: 'get_question_context',
            description: 'Get detailed information about the current question without answering.',
            schema: {
                type: 'object',
                properties: {}
            }
        },
        {
            name: 'continue_lesson',
            description: 'Continue to the next question or screen if available.',
            schema: {
                type: 'object',
                properties: {}
            }
        }
    ];    try {
        console.debug('Registering actions with Neuro API');
        chrome.runtime.sendMessage({
            type: 'neuro_register_actions',
            data: {
                actions: actions
            }        }).then(() => {
            console.debug('Actions successfully registered with Neuro');
            // Let the user know that the actions have been registered
            sendContext('Actions registered with Neuro: submit_answer, get_question_context, continue_lesson', true);
            logToPopup('info', 'Actions successfully registered with Neuro');
        }).catch(error => {
            console.debug('Error registering actions with background script:', error);
            logToPopup('error', 'Error registering actions with background script', { error: error.message });
            
            // Try again after a short delay
            setTimeout(() => {
                try {
                    chrome.runtime.sendMessage({
                        type: 'neuro_register_actions',
                        data: {
                            actions: actions
                        }
                    }).catch(() => {});
                } catch (e) {
                    // Ignore retry errors
                }
            }, 1000);
        });
    } catch (error) {
        console.debug('Failed to register actions:', error);
    }
}

// Helper function to clear previous selections
function clearPreviousSelections(contextType) {
    console.log('Clearing previous selections for context type:', contextType);
    
    switch (contextType) {
        case 'choice':
            // Clear all selected choice options
            const allChoiceElements = Array.from(document.querySelectorAll('[data-test="challenge-choice"]'));
            allChoiceElements.forEach(element => {
                element.setAttribute('aria-checked', 'false');
                element.removeAttribute('data-checked');
                element.classList.remove('_2Nol3'); // Remove selected class
                
                // Also clear any radio inputs
                const input = element.querySelector('input[type="radio"]');
                if (input) {
                    input.checked = false;
                }
            });
            console.log('Cleared', allChoiceElements.length, 'choice selections');
            break;
            
        case 'tap':
            // Clear all selected tokens by clicking them again
            const selectedTokens = Array.from(document.querySelectorAll('[data-test="challenge-tapped-tokens-container"] [data-test*="token"]'));
            selectedTokens.forEach(token => {
                // Find the corresponding button and click it to deselect
                const tokenText = token.innerText.trim();
                const tokenButton = Array.from(document.querySelectorAll('[data-test$="-challenge-tap-token"]'))
                    .find(btn => btn.innerText.trim() === tokenText);
                if (tokenButton) {
                    tokenButton.click();
                }
            });
            console.log('Cleared', selectedTokens.length, 'tapped tokens');
            break;
            
        case 'text':
            // Clear text input
            const textInput = document.querySelector('input[data-test="challenge-text-input"], textarea[data-test="challenge-translate-input"]');
            if (textInput) {
                textInput.value = '';
                textInput.dispatchEvent(new Event('input', { bubbles: true }));
                console.log('Cleared text input');
            }
            break;
    }
}

// Force Neuro to continue to the next question using the actions/force command
function forceNeuroToContinue() {
    logToPopup('info', 'Forcing Neuro to continue to next question');
    
    chrome.runtime.sendMessage({
        type: 'neuro_force_action',
        data: {
            state: 'answer_submitted',
            query: 'Please continue to the next question',
            ephemeral_context: true,
            action_names: ['continue_lesson', 'get_question_context']
        }
    }).catch((error) => {
        logToPopup('error', 'Failed to force Neuro action', { error: error.message });
    });
}

// Handle the submit_answer action from Neuro
function submit_answer(parameters, actionId) {
    console.log('submit_answer called with parameters:', parameters, 'actionId:', actionId);
    logToPopup('info', `Submitting answer for action ${actionId}`, { parameters });
    
    // The answer might be passed as a string directly, or as a property of an object.
    const answer = (typeof parameters === 'string') ? parameters : parameters?.answer;
    
    console.log('Extracted answer:', answer);

    if (answer === undefined || answer === null) {
        console.error('Neuro did not provide a valid answer for submit_answer. Received:', parameters);
        logToPopup('error', 'No answer provided by Neuro', { parameters });
        sendContext('Error: No answer provided by Neuro for submit_answer.', true);
        // Send failure result back to Neuro
        chrome.runtime.sendMessage({
            type: 'neuro_action_result',
            data: {
                id: actionId,
                success: false,
                message: 'No answer data provided by Neuro'
            }
        }).catch(() => {});
        return;
    }const { contextType, options, tokens } = extractQuestionContext();
    console.log('Question context:', { contextType, options, tokens });
    
    // Clear any previous selections before making new ones
    clearPreviousSelections(contextType);
    
    switch (contextType) {        case 'choice':
            console.log('Looking for answer:', answer, 'in options:', options);
            // Find the choice that matches the answer (more flexible matching)
            const targetOption = options.find(opt => {
                const optionText = opt.text.toLowerCase().trim();
                const answerText = answer.toLowerCase().trim();
                // Check if the option text contains the answer, starts with it, or exact match
                return optionText === answerText || 
                       optionText.includes(answerText) || 
                       optionText.startsWith(answerText) ||
                       answerText.includes(optionText);
            });
            
            console.log('Found target option:', targetOption);
            
            if (targetOption) {
                const allChoiceElements = Array.from(document.querySelectorAll('[data-test="challenge-choice"]'));
                console.log('All choice elements:', allChoiceElements);
                
                const targetElement = allChoiceElements.find(el => {
                    let elementText = el.innerText.toLowerCase().trim();
                    // Clean up the element text the same way we clean context
                    elementText = elementText.replace(/\n\d+$/, '').trim();
                    elementText = elementText.replace(/^\d+\.\s*/, '').trim();
                    
                    const answerText = answer.toLowerCase().trim();
                    return elementText === answerText || 
                           elementText.includes(answerText) || 
                           elementText.startsWith(answerText) ||
                           answerText.includes(elementText);
                });
                
                console.log('Found target element:', targetElement);
                
                if (targetElement) {
                    console.log('Attempting to select element');
                    forceSelectRadioOption(targetElement);
                } else {
                    console.error('Could not find element to click for answer:', answer);
                }
            } else {
                console.error('Could not find matching option for answer:', answer);
            }
            break;
            
        case 'tap':
            // For tap challenges, click the tokens that match the answer
            const answerTokens = answer.split(',').map(t => t.trim());
            answerTokens.forEach(token => {
                const tokenButton = tokens.find(btn => btn.innerText.trim().toLowerCase() === token.toLowerCase());
                if (tokenButton) {
                    tokenButton.click();
                }
            });
            break;
            
        case 'text':
            // For text input, type the answer
            const textInput = document.querySelector('input[data-test="challenge-text-input"], textarea[data-test="challenge-translate-input"]');
            if (textInput) {
                textInput.value = answer;
                // Dispatch an input event to ensure React components update
                textInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            break;    }    // After handling the action, click the submit button
    const submitButton = document.querySelector('[data-test="player-next"]');
    if (submitButton) {
        submitButton.click();
        logToPopup('info', `Answer submitted: "${answer}"`, { contextType });
        
        // Update the last answer submitted time in main.js
        updateLastAnswerSubmittedTime();
        
        // Force Neuro to continue to next question after answer submission
        setTimeout(() => {
            forceNeuroToContinue();
        }, 2000); // Wait 2 seconds for the answer to be processed
    } else {
        logToPopup('warn', 'Submit button not found after selecting answer');
    }
    
    // Send success result back to Neuro
    chrome.runtime.sendMessage({
        type: 'neuro_action_result',
        data: {
            id: actionId,
            success: true,
            message: 'Answer submitted successfully'
        }
    }).catch(() => {});
}

// Handle the continue_lesson action from Neuro
function continue_lesson(actionId) {
    const continueButton = document.querySelector('[data-test="player-next"]');
    if (continueButton) {
        continueButton.click();
        // Send success result back to Neuro
        chrome.runtime.sendMessage({
            type: 'neuro_action_result',
            data: {
                id: actionId,
                success: true,
                message: 'Continued lesson successfully'
            }
        }).catch(() => {});
    } else {
        // Send failure result back to Neuro
        chrome.runtime.sendMessage({
            type: 'neuro_action_result',
            data: {
                id: actionId,
                success: false,
                message: 'Continue button not found'
            }
        }).catch(() => {});
    }
}

// Handle the get_question_context action from Neuro
function get_question_context(actionId) {
    const context = extractQuestionContext();
    sendContext(`Current question context: ${JSON.stringify(context)}`);
    // Send success result back to Neuro
    chrome.runtime.sendMessage({
        type: 'neuro_action_result',
        data: {
            id: actionId,
            success: true,
            message: 'Question context retrieved successfully'
        }
    }).catch(() => {});
}
