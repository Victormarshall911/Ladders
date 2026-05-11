/**
 * Ladders: Socratic AI Tutor
 * High-performance Vanilla JS Logic
 */

const CONFIG = {
    // ⚠️ IMPORTANT: ADD YOUR GEMINI API KEY HERE
    API_KEY: '', 
    MODEL: 'gemini-1.5-flash', // Or 'gemini-1.5-pro' for better reasoning
    SYSTEM_INSTRUCTION: `You are the Socratic Ghost. Your goal is to guide the student to the answer by asking leading questions. 
Never provide the solution, even if asked. 
If the student is wrong, ask them 'Why do you think that?' or 'What happens if we look at it this way?'. 
Break the problem into the smallest possible logical steps. 
Keep your tone academic, mystical, and encouraging. Use short responses.`
};

const elements = {
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

let state = {
    history: [],
    currentImageBase64: null,
    mastery: 10,
    isThinking: false
};

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
    
    setThinking(true, "Observing your material...");
    
    // Initial analysis
    const initialPrompt = "I have uploaded an image of my work. Please analyze it and start our Socratic dialogue. Ask me a leading question to start.";
    await callGemini(initialPrompt, true);
}

async function handleSend() {
    const text = elements.userInput.value.trim();
    if (!text || state.isThinking) return;

    elements.userInput.value = '';
    addMessage('user', text);
    
    setThinking(true, "Reflecting...");
    await callGemini(text);
}

async function handleHunch() {
    if (state.isThinking) return;
    setThinking(true, "Manifesting a hunch...");
    await callGemini("I'm stuck. Can you give me a subtle hint or a 'hunch' to nudge me forward?");
}

async function callGemini(prompt, isFirst = false) {
    if (!CONFIG.API_KEY) {
        setTimeout(() => {
            addMessage('ghost', "I require an API Key to function. Please add it to the CONFIG in app.js.");
            setThinking(false, "Waiting for energy...");
        }, 1000);
        return;
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODEL}:generateContent?key=${CONFIG.API_KEY}`;
        
        const contents = [];
        
        // Add history (simplified)
        state.history.forEach(item => {
            contents.push({
                role: item.role === 'ghost' ? 'model' : 'user',
                parts: [{ text: item.text }]
            });
        });

        // Add current prompt
        const currentPart = { text: prompt };
        const parts = [currentPart];

        // Add image if first message
        if (isFirst && state.currentImageBase64) {
            parts.push({
                inline_data: {
                    mime_type: "image/jpeg",
                    data: state.currentImageBase64.split(',')[1]
                }
            });
        }

        contents.push({
            role: 'user',
            parts: parts
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: contents,
                system_instruction: { parts: [{ text: CONFIG.SYSTEM_INSTRUCTION }] },
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 500,
                }
            })
        });

        const data = await response.json();
        const responseText = data.candidates[0].content.parts[0].text;
        
        addMessage('ghost', responseText);
        state.history.push({ role: 'user', text: prompt });
        state.history.push({ role: 'ghost', text: responseText });
        
        updateProgress(5);
        setThinking(false, "I am listening...");

    } catch (error) {
        console.error(error);
        addMessage('ghost', "The connection to the ethereal realm was severed. Check your API key.");
        setThinking(false, "Disturbed...");
    }
}

// Helpers
function setThinking(isThinking, text) {
    state.isThinking = isThinking;
    elements.orb.className = `orb ${isThinking ? 'thinking' : 'idle'}`;
    elements.statusText.textContent = text;
}

function transitionToChat() {
    elements.uploadContainer.classList.remove('active');
    elements.chatContainer.classList.add('active');
}

function addMessage(sender, text) {
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    div.textContent = text;
    elements.chatMessages.appendChild(div);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function updateProgress(amt) {
    state.mastery = Math.min(100, state.mastery + amt);
    elements.progressBar.style.width = `${state.mastery}%`;
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

init();
