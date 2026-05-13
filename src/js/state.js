/**
 * Application State
 */
export const state = {
    history: [],
    currentImageBase64: null,
    mastery: 10,
    isThinking: false,

    // Quiz state
    currentScreen: 'chat',   // 'chat' | 'quiz'
    quizQuestions: [],
    quizAnswers: [],
    quizScore: null,
    currentQuizIndex: 0,
    quizGenerated: false,

    /**
     * Runtime student profile — injected into every system prompt dynamically.
     * This is the "memory" that makes the Ghost feel like a real lecturer.
     */
    student: {
        level: 'unknown',           // 'unknown' | 'beginner' | 'intermediate' | 'advanced'
        frustration: 0,             // 0–5: increments on confused/wrong answers, resets on breakthroughs
        topic: null,                // Detected from image summary or first exchange
        hintLevel: 0,               // 0–5: depth of hints currently active for this problem
        answerDemands: 0,           // How many times student demanded a direct answer this session
        correctStreak: 0,           // Consecutive correct/insightful responses
        exchangeCount: 0,           // Total back-and-forth turns
        awaitingReflection: false,  // true → next ghost prompt asks student to explain WHY
        needsSimplification: false, // true → ghost should use analogies / slow down
    }
};
