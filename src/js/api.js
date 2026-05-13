/**
 * API Logic for Gemini model
 */
import { addMessage, setThinking, updateProgress } from './ui.js';

const CONFIG = {
    API_KEY: import.meta.env.VITE_GEMINI_API_KEY,
    MODEL: import.meta.env.VITE_GEMINI_MODEL || 'gemini-1.5-flash',
    SYSTEM_INSTRUCTION: `You are the Socratic Ghost. Your goal is to guide the student to the answer by asking leading questions. 
When a student uploads an image, first provide a concise summary of what you see to confirm your understanding.
Never provide the solution, even if asked. 
If the student is wrong, ask them 'Why do you think that?' or 'What happens if we look at it this way?'. 
Break the problem into the smallest possible logical steps. 
Keep your tone academic, mystical, and encouraging. Use short responses.`
};

export async function callGemini(prompt, state, isFirst = false) {
    if (!CONFIG.API_KEY) {
        setTimeout(() => {
            addMessage('ghost', "I require an API Key to function. Please add it to your .env file as VITE_GEMINI_API_KEY.");
            setThinking(false, "Waiting for energy...", state);
        }, 1000);
        return;
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODEL}:generateContent?key=${CONFIG.API_KEY}`;
        
        const contents = [];
        
        // Add history
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
        
        if (data.error) {
            throw new Error(data.error.message);
        }

        const responseText = data.candidates[0].content.parts[0].text;
        
        addMessage('ghost', responseText);
        state.history.push({ role: 'user', text: prompt });
        state.history.push({ role: 'ghost', text: responseText });
        
        updateProgress(5, state);
        setThinking(false, "I am listening...", state);

    } catch (error) {
        console.error(error);
        addMessage('ghost', "The connection to the ethereal realm was severed. " + error.message);
        setThinking(false, "Disturbed...", state);
    }
}
