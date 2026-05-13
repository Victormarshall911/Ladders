/**
 * Pedagogy Engine — The Brain Behind the Ghost
 *
 * This module sits between the UI and the API. It:
 *   1. Classifies incoming student messages
 *   2. Manages adaptive hint levels
 *   3. Detects frustration, demands, and shallow reasoning
 *   4. Builds a personalized runtime context block injected into every system prompt
 *   5. Triggers reflection after correct answers
 *
 * No API calls are made here — pure logic only.
 */

// ─── Signal Lexicons ────────────────────────────────────────────────────────

const ANSWER_DEMAND_SIGNALS = [
    'just tell me', 'just give me', 'what is the answer', 'what\'s the answer',
    'give me the answer', 'tell me the answer', 'solve it', 'solve this for me',
    'i give up', 'just show me', 'stop asking questions', 'enough questions',
    'i don\'t want hints', 'skip the questions', 'i need the answer now',
    'just do it', 'answer please', 'final answer', 'tell me directly'
];

const FRUSTRATION_SIGNALS = [
    'i don\'t understand', 'i have no idea', 'i\'m confused', 'i\'m lost',
    'this doesn\'t make sense', 'i can\'t figure', 'i don\'t know',
    'nothing makes sense', 'this is too hard', 'i\'m stuck',
    'i don\'t get it', 'help me', 'explain this', 'what do you mean',
    'i\'m not getting it', 'completely lost'
];

const CORRECT_REASONING_SIGNALS = [
    'because', 'therefore', 'which means', 'that\'s why', 'due to',
    'as a result', 'since', 'this leads to', 'so that', 'in order to',
    'the reason is', 'it follows that', 'thus', 'hence', 'consequently',
    'so', 'which causes', 'that means', 'so then'
];

const CORRECT_ANSWER_SIGNALS = [
    'i think i understand', 'i got it', 'i see now', 'that makes sense',
    'oh i see', 'so the answer is', 'the answer would be', 'i believe the answer',
    'i think the answer', 'it is', 'it\'s', 'so it\'s', 'yes', 'correct',
    'exactly', 'makes sense now', 'i see the pattern', 'i think i see'
];

const ADVANCEMENT_SIGNALS = [
    'i already know', 'that\'s obvious', 'i studied this', 'i know this',
    'we covered this', 'trivial', 'basic', 'simple', 'easy',
    'can you go deeper', 'can we go further', 'what about advanced'
];

// ─── Hint Level Descriptions ─────────────────────────────────────────────────

const HINT_LEVEL_INSTRUCTIONS = [
    // Level 0 — Pure Socratic (default)
    `Use only guiding questions. Do not reveal any part of the answer or method. 
Ask the student what they already know, what they notice, or what they expect.`,

    // Level 1 — Conceptual nudge
    `Ask a conceptual question that points toward the relevant principle.
You may name the concept involved (e.g. "Think about conservation of energy") but do not explain it.`,

    // Level 2 — Principle reveal
    `Reveal the underlying principle or theorem that applies to this problem.
State it clearly but do not show HOW to apply it. Ask the student to try applying it themselves.`,

    // Level 3 — Partial setup
    `Show the first 1–2 steps of the approach or setup. 
Frame it as a scaffold: "Here is how we might begin..." then stop and ask the student to continue.`,

    // Level 4 — Near-complete reasoning
    `Walk through the reasoning up to the final step.
Show almost everything but leave the last logical conclusion for the student to state.`,

    // Level 5 — Full reveal with explanation
    `Provide the complete solution with a full explanation of every step.
After revealing it, ask the student to explain it back to you in their own words.`
];

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Analyze a student message and return a classification object.
 * This drives all state mutations in main.js.
 *
 * @param {string} text - Raw student message
 * @param {object} state - Full app state
 * @returns {{ type: string, frustrationDelta: number, hintBoost: number, levelSignal: string|null }}
 */
export function analyzeMessage(text, state) {
    const lower = text.toLowerCase();

    const isDemand  = ANSWER_DEMAND_SIGNALS.some(s => lower.includes(s));
    const isFrustrated = FRUSTRATION_SIGNALS.some(s => lower.includes(s));
    const hasReasoning = CORRECT_REASONING_SIGNALS.some(s => lower.includes(s));
    const seemsCorrect = CORRECT_ANSWER_SIGNALS.some(s => lower.includes(s));
    const isAdvanced = ADVANCEMENT_SIGNALS.some(s => lower.includes(s));

    let type = 'neutral';
    let frustrationDelta = 0;
    let hintBoost = 0;
    let levelSignal = null;

    if (isDemand) {
        type = 'demand';
        hintBoost = 1;           // Escalate hint level instead of complying
        frustrationDelta = 1;
        state.student.answerDemands++;
    } else if (isFrustrated) {
        type = 'frustrated';
        frustrationDelta = 1;
        hintBoost = 1;
        state.student.needsSimplification = true;
    } else if (isAdvanced) {
        type = 'advanced';
        levelSignal = 'advanced';
        frustrationDelta = -1;
        state.student.needsSimplification = false;
    } else if (seemsCorrect && hasReasoning) {
        type = 'correct_with_reasoning';
        frustrationDelta = -2;
        state.student.correctStreak++;
        state.student.needsSimplification = false;
    } else if (seemsCorrect && !hasReasoning) {
        type = 'correct_no_reasoning'; // Possible memorization
        frustrationDelta = -1;
        state.student.correctStreak++;
    } else if (isFrustrated || lower.includes('?')) {
        type = 'confused';
        frustrationDelta = 1;
    }

    // Infer level from behavior patterns
    if (!levelSignal) {
        if (state.student.correctStreak >= 3 && state.student.frustration <= 1) {
            levelSignal = 'advanced';
        } else if (state.student.frustration >= 3) {
            levelSignal = 'beginner';
        } else if (state.student.exchangeCount >= 4) {
            levelSignal = 'intermediate';
        }
    }

    return { type, frustrationDelta, hintBoost, levelSignal };
}

/**
 * Apply an analysis result to update the student state.
 * Call this BEFORE sending to the API.
 *
 * @param {object} analysis - Result from analyzeMessage()
 * @param {object} state - Full app state
 */
export function applyAnalysis(analysis, state) {
    const s = state.student;

    // Update frustration (clamp 0–5)
    s.frustration = Math.max(0, Math.min(5, s.frustration + analysis.frustrationDelta));

    // Escalate hint level (clamp 0–5)
    s.hintLevel = Math.max(0, Math.min(5, s.hintLevel + analysis.hintBoost));

    // Update level if inferred
    if (analysis.levelSignal && s.level === 'unknown') {
        s.level = analysis.levelSignal;
    } else if (analysis.levelSignal === 'advanced' && s.level !== 'advanced') {
        s.level = analysis.levelSignal;
    }

    // Trigger reflection after a correct answer
    if (analysis.type === 'correct_with_reasoning' || analysis.type === 'correct_no_reasoning') {
        s.awaitingReflection = true;
        // Reset hint level — the student solved the step, move to next
        s.hintLevel = 0;
    }

    s.exchangeCount++;
}

/**
 * After the ghost responds, mark reflection as delivered so it doesn't repeat.
 *
 * @param {object} state - Full app state
 */
export function markReflectionDelivered(state) {
    state.student.awaitingReflection = false;
}

/**
 * Set the topic from the first image analysis.
 * Called from main.js after the ghost's first response.
 *
 * @param {string} ghostResponse - The ghost's first response text
 * @param {object} state - Full app state
 */
export function extractTopic(ghostResponse, state) {
    if (state.student.topic) return; // Already set
    // Take the first sentence of the ghost's response as a rough topic label
    const firstSentence = ghostResponse.split(/[.!?]/)[0].trim();
    state.student.topic = firstSentence.length > 80
        ? firstSentence.slice(0, 80) + '…'
        : firstSentence;
}

/**
 * Build the runtime student context block to inject into the system prompt.
 *
 * @param {object} state - Full app state
 * @returns {string}
 */
export function buildRuntimeContext(state) {
    const s = state.student;

    const levelLabel = {
        unknown: 'unknown — treat as a first-time learner until you gather signals',
        beginner: 'beginner — use simple language, analogies, and very small steps',
        intermediate: 'intermediate — assume basic knowledge, challenge with depth',
        advanced: 'advanced — be rigorous, challenge assumptions, skip basics'
    }[s.level] ?? 'unknown';

    const frustrationLabel =
        s.frustration >= 4 ? 'very high — be extra patient, warm, and use analogies. Slow right down.' :
        s.frustration >= 2 ? 'moderate — simplify and reassure without revealing answers' :
        s.frustration === 0 ? 'none — student is calm and engaged' :
        'low — student is slightly uncertain but coping';

    const lines = [
        `RUNTIME STUDENT PROFILE (use this to adapt your response):`,
        `- Student Level: ${levelLabel}`,
        `- Frustration: ${frustrationLabel} (${s.frustration}/5)`,
        `- Answer Demands This Session: ${s.answerDemands} (${s.answerDemands >= 3 ? 'student is trying to shortcut — do NOT comply, escalate hints instead' : 'within normal range'})`,
        `- Current Topic: ${s.topic ?? 'not yet identified'}`,
        `- Needs Simplification: ${s.needsSimplification ? 'YES — use analogies, visuals, step-by-step breakdown' : 'no'}`,
        `- Correct Answer Streak: ${s.correctStreak}`,
        `- Total Exchanges: ${s.exchangeCount}`,
    ];

    if (s.awaitingReflection) {
        lines.push(
            `- REFLECTION REQUIRED: The student just answered correctly. ` +
            `Before moving on, ask them to explain WHY the answer works in their own words. ` +
            `Do not just accept the correct answer — probe the understanding behind it.`
        );
    }

    return lines.join('\n');
}

/**
 * Build the hint instruction block for the current hint level.
 *
 * @param {object} state - Full app state
 * @returns {string}
 */
export function getHintInstruction(state) {
    const level = Math.min(5, state.student.hintLevel);
    return [
        `CURRENT HINT LEVEL: ${level}/5`,
        HINT_LEVEL_INSTRUCTIONS[level]
    ].join('\n');
}

/**
 * Return whether to show the hint level chip in the UI.
 *
 * @param {object} state - Full app state
 * @returns {boolean}
 */
export function isHintActive(state) {
    return state.student.hintLevel > 0;
}
