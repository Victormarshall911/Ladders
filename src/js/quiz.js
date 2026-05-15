/**
 * Quiz Module — Generation, Rendering, and Grading
 * Uses OpenRouter (OpenAI-compatible) API with model fallback
 */
import { elements, setThinking, transitionToQuiz, transitionBackToChat } from './ui.js';
import { updateProgress } from './ui.js';

const QUIZ_CONFIG = {
    API_KEY: import.meta.env.VITE_OPENROUTER_API_KEY,
    API_URL: 'https://openrouter.ai/api/v1/chat/completions',
    NUM_QUESTIONS: 5
};

/** Same fallback chain as api.js — text-only models work fine for quiz generation */
const QUIZ_MODEL_CHAIN = [
    import.meta.env.VITE_AI_MODEL || 'nvidia/nemotron-nano-12b-v2-vl:free',
    'deepseek/deepseek-v4-flash:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
];

/**
 * Generate quiz questions from conversation history via OpenRouter
 */
export async function generateQuiz(state) {
    if (!QUIZ_CONFIG.API_KEY) return;

    // Reset quiz state
    state.quizQuestions = [];
    state.quizAnswers = [];
    state.quizScore = null;
    state.currentQuizIndex = 0;
    state.quizGenerated = false;

    // Build conversation summary for the prompt
    const conversationSummary = state.history
        .map(item => `${item.role === 'ghost' ? 'Tutor' : 'Student'}: ${item.text}`)
        .join('\n');

    const quizPrompt = `Based on the following tutoring conversation, generate exactly ${QUIZ_CONFIG.NUM_QUESTIONS} multiple-choice quiz questions to test the student's understanding. 

CONVERSATION:
${conversationSummary}

RULES:
- Each question should test a concept discussed in the conversation
- Each question must have exactly 4 options labeled A, B, C, D
- Only one option should be correct
- Return ONLY valid JSON, no markdown, no code fences
- Use this exact format:

[
  {
    "question": "What is...?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Brief explanation of why this is correct"
  }
]`;

    try {
        let responseText = null;

        for (const model of QUIZ_MODEL_CHAIN) {
            console.log(`[Quiz] Trying model: ${model}`);
            const response = await fetch(QUIZ_CONFIG.API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${QUIZ_CONFIG.API_KEY}`,
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'Ladders AI',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'user', content: quizPrompt }
                    ],
                    temperature: 0.4,
                    max_tokens: 2000
                })
            });

            const data = await response.json();

            if (data.error) {
                const code = data.error.code || response.status;
                console.warn(`[Quiz] ${model} failed: ${data.error.message}`);
                if (code !== 429 && code !== 503 && code !== 502) break;
                continue;
            }

            responseText = data.choices[0].message.content;
            console.log(`[Quiz] Success with: ${model}`);
            break;
        }

        if (!responseText) throw new Error('All models unavailable for quiz generation');

        // Clean potential markdown code fences
        responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

        const questions = JSON.parse(responseText);

        if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error('Invalid quiz format received');
        }

        state.quizQuestions = questions.slice(0, QUIZ_CONFIG.NUM_QUESTIONS);
        state.quizAnswers = new Array(state.quizQuestions.length).fill(-1);
        state.quizGenerated = true;

        return true;
    } catch (error) {
        console.error('Quiz generation error:', error);
        return false;
    }
}

/**
 * Render the current quiz question
 */
export function renderQuiz(state) {
    const container = elements.quizContent;
    if (!container) return;

    const q = state.quizQuestions[state.currentQuizIndex];
    const total = state.quizQuestions.length;
    const current = state.currentQuizIndex + 1;
    const selectedAnswer = state.quizAnswers[state.currentQuizIndex];

    container.innerHTML = `
        <div class="quiz-progress-info">
            <span class="quiz-step">Question ${current} of ${total}</span>
            <div class="quiz-dots">
                ${state.quizQuestions.map((_, i) => `
                    <span class="quiz-dot ${i < state.currentQuizIndex ? 'completed' : ''} ${i === state.currentQuizIndex ? 'active' : ''} ${state.quizAnswers[i] !== -1 ? 'answered' : ''}"></span>
                `).join('')}
            </div>
        </div>

        <div class="quiz-question-card">
            <h2 class="quiz-question-text">${q.question}</h2>
        </div>

        <div class="quiz-options">
            ${q.options.map((opt, i) => `
                <button class="quiz-option ${selectedAnswer === i ? 'selected' : ''}" data-index="${i}">
                    <span class="option-letter">${String.fromCharCode(65 + i)}</span>
                    <span class="option-text">${opt}</span>
                </button>
            `).join('')}
        </div>

        <div class="quiz-nav">
            ${state.currentQuizIndex > 0 ? '<button class="quiz-prev-btn secondary-btn">← Previous</button>' : '<div></div>'}
            ${state.currentQuizIndex < total - 1 
                ? `<button class="quiz-next-btn secondary-btn" ${selectedAnswer === -1 ? 'disabled' : ''}>Next →</button>`
                : `<button class="quiz-submit-btn secondary-btn submit" ${state.quizAnswers.includes(-1) ? 'disabled' : ''}>Submit Quiz</button>`
            }
        </div>
    `;

    // Wire up option click handlers
    container.querySelectorAll('.quiz-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index);
            handleQuizAnswer(idx, state);
        });
    });

    // Wire up nav handlers
    const prevBtn = container.querySelector('.quiz-prev-btn');
    const nextBtn = container.querySelector('.quiz-next-btn');
    const submitBtn = container.querySelector('.quiz-submit-btn');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            state.currentQuizIndex--;
            renderQuiz(state);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            state.currentQuizIndex++;
            renderQuiz(state);
        });
    }

    if (submitBtn) {
        submitBtn.addEventListener('click', () => {
            submitQuiz(state);
        });
    }
}

/**
 * Handle a quiz answer selection
 */
function handleQuizAnswer(index, state) {
    state.quizAnswers[state.currentQuizIndex] = index;
    renderQuiz(state);
}

/**
 * Submit the quiz, calculate score, and render results
 */
function submitQuiz(state) {
    let correct = 0;
    state.quizQuestions.forEach((q, i) => {
        if (state.quizAnswers[i] === q.correctIndex) {
            correct++;
        }
    });

    const total = state.quizQuestions.length;
    const percentage = Math.round((correct / total) * 100);
    state.quizScore = percentage;

    // Update mastery based on quiz
    const masteryBoost = Math.round(percentage / 5);
    updateProgress(masteryBoost, state);

    renderResults(state, correct, total, percentage);
}

/**
 * Render quiz results
 */
function renderResults(state, correct, total, percentage) {
    const container = elements.quizContent;

    let grade, gradeClass, feedback;
    if (percentage >= 90) {
        grade = 'A';
        gradeClass = 'grade-a';
        feedback = 'Exceptional mastery! The spirits are impressed.';
    } else if (percentage >= 80) {
        grade = 'B';
        gradeClass = 'grade-b';
        feedback = 'Strong understanding. You are ascending the ladder.';
    } else if (percentage >= 70) {
        grade = 'C';
        gradeClass = 'grade-c';
        feedback = 'Decent grasp, but there is more to uncover.';
    } else if (percentage >= 60) {
        grade = 'D';
        gradeClass = 'grade-d';
        feedback = 'You have begun the journey. Continue seeking.';
    } else {
        grade = 'F';
        gradeClass = 'grade-f';
        feedback = 'The path requires more study. Return to the dialogue.';
    }

    container.innerHTML = `
        <div class="quiz-results">
            <div class="results-header">
                <div class="grade-badge ${gradeClass}">${grade}</div>
                <div class="score-display">
                    <span class="score-number">${percentage}%</span>
                    <span class="score-detail">${correct} of ${total} correct</span>
                </div>
            </div>

            <p class="results-feedback">${feedback}</p>

            <div class="results-breakdown">
                ${state.quizQuestions.map((q, i) => {
                    const isCorrect = state.quizAnswers[i] === q.correctIndex;
                    return `
                        <div class="result-item ${isCorrect ? 'correct' : 'incorrect'}">
                            <div class="result-indicator">${isCorrect ? '✓' : '✗'}</div>
                            <div class="result-detail">
                                <p class="result-question">${q.question}</p>
                                <p class="result-answer">
                                    Your answer: <strong>${q.options[state.quizAnswers[i]]}</strong>
                                    ${!isCorrect ? `<br>Correct: <strong>${q.options[q.correctIndex]}</strong>` : ''}
                                </p>
                                <p class="result-explanation">${q.explanation}</p>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="results-actions">
                <button class="quiz-retry-btn secondary-btn">Retake Quiz</button>
                <button class="quiz-back-btn secondary-btn">Back to Chat</button>
            </div>
        </div>
    `;

    // Wire up action buttons
    container.querySelector('.quiz-retry-btn').addEventListener('click', async () => {
        state.currentQuizIndex = 0;
        state.quizAnswers = new Array(state.quizQuestions.length).fill(-1);
        state.quizScore = null;
        renderQuiz(state);
    });

    container.querySelector('.quiz-back-btn').addEventListener('click', () => {
        transitionBackToChat();
        state.currentScreen = 'chat';
    });
}
