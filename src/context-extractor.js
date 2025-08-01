// src/context-extractor.js

console.log('Neuro-Duolingo context-extractor.js loaded');

// Helper: Extract question and answer tokens from the page (for different challenge types)
function extractQuestionContext() {    // Try to find the question prompt
    const header = document.querySelector('[data-test="challenge-header"]');
    let question = header ? header.innerText.trim() : '';
    let contextType = 'unknown';
    let options = [];
    let selectedOption = null;
    let tokens = [];
    let selectedTokens = [];
    let textInputValue = '';
    let isAudioQuestion = false;
    
    // Check if this is an audio question
    const audioButton = document.querySelector('[data-test="player-button"]');
    if (audioButton || question.toLowerCase().includes('what do you hear') || question.toLowerCase().includes('listen')) {
        isAudioQuestion = true;
    }
      // Check for tap challenge
    const tapTokenButtons = Array.from(document.querySelectorAll('[data-test$="-challenge-tap-token"]'));
    if (tapTokenButtons.length > 0) {
        tokens = tapTokenButtons.map(btn => {
            let text = btn.innerText.trim();
            // Clean up token text by removing extra formatting
            text = text.replace(/\n.*$/, '').trim(); // Remove anything after newline
            return text;
        });
        
        // Get selected tokens (those that have been clicked)
        const selectedTapTokens = Array.from(document.querySelectorAll('[data-test="challenge-tapped-tokens-container"] [data-test*="token"]'));
        selectedTokens = selectedTapTokens.map(token => {
            let text = token.innerText.trim();
            text = text.replace(/\n.*$/, '').trim();
            return text;
        });
        
        contextType = 'tap';
    }
      // Check for multiple choice challenge
    const multipleChoiceOptions = Array.from(document.querySelectorAll('[data-test="challenge-choice"]'));
    if (multipleChoiceOptions.length > 0) {
        // For each option, note if it's selected
        options = multipleChoiceOptions.map(opt => {
            const isSelected = opt.getAttribute('aria-checked') === 'true';
            let text = opt.innerText.trim();
            
            // Clean up the text by removing trailing numbers and extra formatting
            text = text.replace(/\n\d+$/, '').trim(); // Remove trailing newline + number
            text = text.replace(/^\d+\.\s*/, '').trim(); // Remove leading number + dot
            
            // If this option is selected, also store it separately
            if (isSelected) {
                selectedOption = text;
            }
            
            return {
                text: text,
                isSelected: isSelected
            };
        });
        
        contextType = 'choice';
    }
    
    // Check for text input challenge
    const textInput = document.querySelector('input[data-test="challenge-text-input"], textarea[data-test="challenge-translate-input"]');
    if (textInput) {
        textInputValue = textInput.value;
        contextType = 'text';
    }
      // Return a structured object with all the context
    return {
        question: question,
        contextType: contextType,
        options: options,
        selectedOption: selectedOption,
        tokens: tokens,
        selectedTokens: selectedTokens,
        textInputValue: textInputValue,
        isAudioQuestion: isAudioQuestion
    };
}
