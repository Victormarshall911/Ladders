/**
 * Ladders: Socratic AI Tutor
 * Entry Point
 */
import { state } from './state.js';
import { elements, addMessage, setThinking, transitionToChat } from './ui.js';
import { callGemini } from './api.js';

function init() {
    elements.imageUpload.addEventListener('change', handleImageSelection);
    elements.sendBtn.addEventListener('click', handleSend);
    elements.userInput.addEventListener('keydown', (e) => e.key === 'Enter' && handleSend());
    elements.hunchBtn.addEventListener('click', handleHunch);
    
    addMessage('ghost', "Greetings, seeker. Show me what you are working on, and we shall find the path together.");
}

async function handleImageSelection(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Convert image to base64
    state.currentImageBase64 = await fileToBase64(file);
    
    transitionToChat();
    
    setThinking(true, "Observing your material...", state);
    
    // Initial analysis
    const initialPrompt = "I have uploaded an image of my work. Please analyze it and start our Socratic dialogue. Ask me a leading question to start.";
    await callGemini(initialPrompt, state, true);
}

async function handleSend() {
    const text = elements.userInput.value.trim();
    if (!text || state.isThinking) return;

    elements.userInput.value = '';
    addMessage('user', text);
    
    setThinking(true, "Reflecting...", state);
    await callGemini(text, state);
}

async function handleHunch() {
    if (state.isThinking) return;
    setThinking(true, "Manifesting a hunch...", state);
    await callGemini("I'm stuck. Can you give me a subtle hint or a 'hunch' to nudge me forward?", state);
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Start the application
init();
