/**
 * Ladders: Socratic AI Tutor By Victor
 * Entry Point
 */
import { state } from './state.js';
import { elements, addMessage, addImageMessage, setThinking, transitionToChat, transitionToQuiz, showQuizButton, setQuizLoading } from './ui.js';
import { callGemini } from './api.js';
import { generateQuiz, renderQuiz } from './quiz.js';

function init() {
    elements.imageUpload.addEventListener('change', handleImageSelection);
    elements.cameraUpload.addEventListener('change', handleImageSelection);
    elements.sendBtn.addEventListener('click', handleSend);
    elements.userInput.addEventListener('keydown', (e) => e.key === 'Enter' && handleSend());
    elements.hunchBtn.addEventListener('click', handleHunch);
    elements.quizBtn.addEventListener('click', handleQuiz);
    
    addMessage('ghost', "Greetings, seeker. Show me what you are working on, and we shall find the path together.");
}

async function handleImageSelection(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Convert image to base64
    state.currentImageBase64 = await fileToBase64(file);
    
    // Show the image in chat before transitioning
    addImageMessage(state.currentImageBase64);
    
    transitionToChat();
    
    setThinking(true, "Observing your material...", state);
    
    // Initial analysis
    const initialPrompt = "I have uploaded an image of my work. Please briefly explain what you see to confirm your understanding, and then ask me a leading question to start our Socratic dialogue.";
    await callGemini(initialPrompt, state, true);
    
    // After first exchange, check if we should show quiz button
    checkQuizAvailability();
}

async function handleSend() {
    const text = elements.userInput.value.trim();
    if (!text || state.isThinking) return;

    elements.userInput.value = '';
    addMessage('user', text);
    
    setThinking(true, "Reflecting...", state);
    await callGemini(text, state);
    
    // Check if quiz should become available
    checkQuizAvailability();
}

async function handleHunch() {
    if (state.isThinking) return;
    setThinking(true, "Manifesting a hunch...", state);
    await callGemini("I'm stuck. Can you give me a subtle hint or a 'hunch' to nudge me forward?", state);
    
    checkQuizAvailability();
}

async function handleQuiz() {
    if (state.isThinking) return;
    
    state.currentScreen = 'quiz';
    transitionToQuiz();
    setQuizLoading(true);
    setThinking(true, "Conjuring your trial...", state);

    const success = await generateQuiz(state);
    
    setThinking(false, "The trial awaits...", state);
    setQuizLoading(false);

    if (success) {
        renderQuiz(state);
    } else {
        elements.quizContent.innerHTML = `
            <div class="quiz-error">
                <p>The ethereal realm could not conjure a quiz. Please continue the dialogue and try again.</p>
                <button class="secondary-btn quiz-error-back">Return to Chat</button>
            </div>
        `;
        elements.quizContent.querySelector('.quiz-error-back').addEventListener('click', () => {
            const { transitionBackToChat } = require('./ui.js');
            transitionBackToChat();
            state.currentScreen = 'chat';
        });
    }
}

/**
 * Show the quiz button after the user has had at least 3 exchanges
 */
function checkQuizAvailability() {
    const userMessages = state.history.filter(h => h.role !== 'ghost').length;
    if (userMessages >= 2) {
        showQuizButton();
    }
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
