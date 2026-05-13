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
    quizGenerated: false
};
