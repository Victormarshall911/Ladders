/**
 * UI Manipulations & Elements
 */
export const elements = {
    orb: document.getElementById('ghost-orb'),
    statusText: document.getElementById('status-text'),
    hintChip: document.getElementById('hint-chip'),
    uploadContainer: document.getElementById('upload-container'),
    chatContainer: document.getElementById('chat-container'),
    imageUpload: document.getElementById('image-upload'),
    cameraUpload: document.getElementById('camera-upload'),
    chatMessages: document.getElementById('chat-messages'),
    userInput: document.getElementById('user-input'),
    sendBtn: document.getElementById('send-btn'),
    hunchBtn: document.getElementById('hunch-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    progressBar: document.getElementById('progress-bar'),

    // Quiz elements
    quizContainer: document.getElementById('quiz-container'),
    quizContent: document.getElementById('quiz-content'),
    quizBtn: document.getElementById('quiz-btn'),
    quizLoading: document.getElementById('quiz-loading')
};

export function setThinking(isThinking, text, state) {
    state.isThinking = isThinking;
    elements.orb.className = `orb ${isThinking ? 'thinking' : 'idle'}`;
    elements.statusText.textContent = text;
}

export function transitionToChat() {
    elements.uploadContainer.classList.remove('active');
    elements.chatContainer.classList.add('active');

    // Compact the orb to give messages more room
    const orbSection = document.getElementById('orb-section');
    const orbWrap = orbSection?.querySelector('.orb-wrap');
    const orb = elements.orb;

    if (orbSection) {
        orbSection.style.padding = '10px 0 6px';
        orbSection.style.gap = '6px';
    }
    if (orbWrap) {
        orbWrap.style.width = '52px';
        orbWrap.style.height = '52px';
    }
    if (orb) {
        orb.style.width = '36px';
        orb.style.height = '36px';
    }
}

export function transitionToQuiz() {
    elements.chatContainer.classList.remove('active');
    elements.uploadContainer.classList.remove('active');
    elements.quizContainer.classList.add('active');
    elements.quizBtn.style.display = 'none';
    elements.hunchBtn.style.display = 'none';
}

export function transitionBackToChat() {
    elements.quizContainer.classList.remove('active');
    elements.chatContainer.classList.add('active');
    elements.quizBtn.style.display = '';
    elements.hunchBtn.style.display = '';
}

export function addMessage(sender, text) {
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    div.textContent = text;
    elements.chatMessages.appendChild(div);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

export function addImageMessage(imageSrc) {
    const div = document.createElement('div');
    div.className = 'message user image-message';

    const img = document.createElement('img')
    img.src = imageSrc;
    img.className = 'message-image';
    img.alt = 'Uploaded study material';

    const label = document.createElement('span');
    label.className = 'image-label';
    label.textContent = 'Shared an image';

    div.appendChild(img);
    div.appendChild(label);
    elements.chatMessages.appendChild(div);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

export function showQuizButton() {
    if (elements.quizBtn) {
        elements.quizBtn.classList.add('visible');
    }
}

export function setQuizLoading(isLoading) {
    if (elements.quizLoading) {
        elements.quizLoading.style.display = isLoading ? 'flex' : 'none';
    }
    if (elements.quizContent) {
        elements.quizContent.style.display = isLoading ? 'none' : 'block';
    }
}

export function updateProgress(amt, state) {
    state.mastery = Math.min(100, state.mastery + amt);
    elements.progressBar.style.width = `${state.mastery}%`;
}

/**
 * Update the hint level chip beneath the orb.
 * Shows filled/empty dots representing current hint depth (0–5).
 * Hidden when hintLevel === 0.
 *
 * @param {object} state - Full app state
 */
export function updateHintChip(state) {
    const chip = elements.hintChip;
    if (!chip) return;

    const level = state.student.hintLevel;

    if (level === 0) {
        chip.classList.remove('visible');
        return;
    }

    const dots = Array.from({ length: 5 }, (_, i) =>
        `<span class="hint-dot ${i < level ? 'filled' : ''}"></span>`
    ).join('');

    chip.innerHTML = `${dots}<span class="hint-label">Hint ${level}/5</span>`;
    chip.classList.add('visible');
}
