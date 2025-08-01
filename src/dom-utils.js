// src/dom-utils.js

console.log('Neuro-Duolingo dom-utils.js loaded');

// Helper function to reliably select a radio button option in Duolingo
function forceSelectRadioOption(element) {
    if (!element) {
        console.debug('No element provided to forceSelectRadioOption');
        return;
    }

    console.log('Attempting to select radio option:', element);

    // Method 1: Direct click on the element
    element.click();
    console.log('Method 1: Direct click completed');

    // Method 2: Find and click a child input element if it exists
    const input = element.querySelector('input[type="radio"]');
    if (input) {
        input.click();
        console.log('Method 2: Input click completed');
    } else {
        console.log('Method 2: No radio input found');
    }

    // Method 3: Manually set ARIA and data attributes
    element.setAttribute('aria-checked', 'true');
    element.setAttribute('data-checked', 'true');
    element.classList.add('_2Nol3'); // Class for selected
    console.log('Method 3: Attributes set');

    // Method 4: Dispatch mouse events to simulate a real click
    const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
    });
    element.dispatchEvent(event);
    console.log('Method 4: Mouse event dispatched');
}
