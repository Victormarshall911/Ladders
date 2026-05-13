/**
 * Ladders: Socratic AI Tutor By Victor
 * Entry Point — wires the pedagogy engine into every send/response cycle
 */
import { state } from './state.js';
import {
    elements, addMessage, addImageMessage, setThinking,
    transitionToChat, transitionToQuiz, showQuizButton,
    setQuizLoading, updateHintChip
} from './ui.js';
import { callGemini } from './api.js';
import { generateQuiz, renderQuiz } from './quiz.js';
import {
    analyzeMessage, applyAnalysis,
    markReflectionDelivered, extractTopic
} from './engine.js';

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

    state.currentImageBase64 = await fileToBase64(file);
    addImageMessage(state.currentImageBase64);
    transitionToChat();
    setThinking(true, "Observing your material...", state);

    const initialPrompt = "I have uploaded an image of my work. Please briefly explain what you see to confirm your understanding, and then ask me a leading question to start our Socratic dialogue.";
    const response = await callGemini(initialPrompt, state, true);

    // Extract topic from the ghost's first response for the runtime context
    if (response) {
        extractTopic(response, state);
    }

    checkQuizAvailability();
}

async function handleSend() {
    const text = elements.userInput.value.trim();
    if (!text || state.isThinking) return;

    elements.userInput.value = '';
    addMessage('user', text);

    // ── Pedagogy Engine: classify and update student state BEFORE calling API ──
    const analysis = analyzeMessage(text, state);
    applyAnalysis(analysis, state);
    updateHintChip(state);
    // ──────────────────────────────────────────────────────────────────────────

    // Pick a thinking status that reflects what the ghost is doing
    const thinkingLabel =
        analysis.type === 'demand'      ? "Redirecting your path…" :
        analysis.type === 'frustrated'  ? "Searching for a clearer way…" :
        analysis.type === 'correct_with_reasoning' ? "Acknowledging your insight…" :
        "Reflecting…";

    setThinking(true, thinkingLabel, state);
    const response = await callGemini(text, state);

    // ── After response: clear reflection flag, update topic if not yet set ──
    if (response) {
        markReflectionDelivered(state);
        if (!state.student.topic) extractTopic(response, state);
    }
    // ──────────────────────────────────────────────────────────────────────────

    checkQuizAvailability();
}

async function handleHunch() {
    if (state.isThinking) return;

    // A hunch request is a mild hint escalation
    state.student.hintLevel = Math.min(5, state.student.hintLevel + 1);
    updateHintChip(state);

    setThinking(true, "Manifesting a hunch...", state);
    const response = await callGemini(
        "I'm stuck. Can you give me a subtle hint or a 'hunch' to nudge me forward?",
        state
    );

    if (response) markReflectionDelivered(state);
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
 * Show the quiz button after the user has had at least 2 exchanges
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
