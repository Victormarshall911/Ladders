/**
 * UI Manipulation & Elements
 */
export const elements = {
    orb: document.getElementById('ghost-orb'),
    statusText: document.getElementById('status-text'),
    uploadContainer: document.getElementById('upload-container'),
    chatContainer: document.getElementById('chat-container'),
    imageUpload: document.getElementById('image-upload'),
    chatMessages: document.getElementById('chat-messages'),
    userInput: document.getElementById('user-input'),
    sendBtn: document.getElementById('send-btn'),
    hunchBtn: document.getElementById('hunch-btn'),
    progressBar: document.getElementById('progress-bar')
};

export function setThinking(isThinking, text, state) {
    state.isThinking = isThinking;
    elements.orb.className = `orb ${isThinking ? 'thinking' : 'idle'}`;
    elements.statusText.textContent = text;
}

export function transitionToChat() {
    elements.uploadContainer.classList.remove('active');
    elements.chatContainer.classList.add('active');
}

export function addMessage(sender, text) {
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    div.textContent = text;
    elements.chatMessages.appendChild(div);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

export function updateProgress(amt, state) {
    state.mastery = Math.min(100, state.mastery + amt);
    elements.progressBar.style.width = `${state.mastery}%`;
}
