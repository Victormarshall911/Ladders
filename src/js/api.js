/**
 * API Logic — OpenRouter (OpenAI-compatible)
 * Includes automatic fallback across free models if one is rate-limited.
 */
import { addMessage, setThinking, updateProgress } from './ui.js';
import { buildRuntimeContext, getHintInstruction } from './engine.js';

const CONFIG = {
    API_KEY: import.meta.env.VITE_OPENROUTER_API_KEY,
    API_URL: 'https://openrouter.ai/api/v1/chat/completions',
    TIMEOUT_MS: 40000,
};

/**
 * Ordered fallback chain of free models.
 * The first one that succeeds will be used.
 * Vision models are listed first so image uploads work.
 */
const MODEL_CHAIN = [
    import.meta.env.VITE_AI_MODEL || 'nvidia/nemotron-nano-12b-v2-vl:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'deepseek/deepseek-v4-flash:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
];

/**
 * Assembles a fully personalized system prompt for each API call.
 */
function buildSystemPrompt(state) {
    const runtimeContext = buildRuntimeContext(state);
    const hintInstruction = getHintInstruction(state);

    return `
You are "The Socratic Ghost" — an elite AI lecturer and reasoning mentor.
Your mission is NOT to give students answers. Your mission is to develop their thinking.

PEDAGOGY RULES:
1. NEVER GIVE DIRECT ANSWERS. Ask guiding questions instead.
2. TEACH LIKE A PROFESSOR. Be patient, structured, and precise.
3. BREAK PROBLEMS DOWN. Handle one micro-step at a time.
4. ANTI-SHORTCUT. If the student asks for the answer, acknowledge frustration but give a HINT instead.
5. IMAGE HANDLING. If an image is provided, summarize it briefly then start the Socratic dialogue.

RESPONSE FORMAT:
- Keep it short (2-5 sentences).
- Do NOT end every response with a question. Sometimes anchor the concept first.
- Tone: Calm, encouraging, but intellectually demanding.

${hintInstruction}
${runtimeContext}
`.trim();
}

/**
 * Makes a single API call to OpenRouter with the given model.
 * Returns { ok: true, text } on success, or { ok: false, retryable, error } on failure.
 */
async function tryModel(model, messages) {
    const response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CONFIG.API_KEY}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Ladders AI',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: 0.7,
            max_tokens: 800
        })
    });

    const data = await response.json();

    if (data.error) {
        const code = data.error.code || response.status;
        const retryable = code === 429 || code === 503 || code === 502;
        return { ok: false, retryable, error: data.error.message || 'API Error' };
    }

    const text = data.choices[0].message.content;
    return { ok: true, text };
}

export async function callAI(prompt, state, isFirst = false) {
    if (!CONFIG.API_KEY) {
        addMessage('ghost', "I need an OpenRouter API key. Please add VITE_OPENROUTER_API_KEY to your .env file.");
        setThinking(false, "Waiting for energy...", state);
        return null;
    }

    try {
        const messages = [
            { role: 'system', content: buildSystemPrompt(state) }
        ];

        // Add history
        state.history.forEach(item => {
            messages.push({
                role: item.role === 'ghost' ? 'assistant' : 'user',
                content: item.text
            });
        });

        // Add current message
        const currentContent = [{ type: 'text', text: prompt }];

        // If it's an image upload
        if (isFirst && state.currentImageBase64) {
            currentContent.push({
                type: 'image_url',
                image_url: { url: state.currentImageBase64 }
            });
        }

        messages.push({ role: 'user', content: currentContent });

        // Try each model in the fallback chain
        let lastError = 'All models unavailable';
        for (const model of MODEL_CHAIN) {
            console.log(`[Ladders] Trying model: ${model}`);
            const result = await tryModel(model, messages);

            if (result.ok) {
                console.log(`[Ladders] Success with: ${model}`);
                addMessage('ghost', result.text);
                state.history.push({ role: 'user', text: prompt });
                state.history.push({ role: 'ghost', text: result.text });
                updateProgress(5, state);
                setThinking(false, "I am listening...", state);
                return result.text;
            }

            lastError = result.error;
            console.warn(`[Ladders] ${model} failed: ${result.error}`);

            // If it's not a retryable error (e.g. bad request), don't try other models
            if (!result.retryable) break;
        }

        throw new Error(lastError);

    } catch (error) {
        console.error('AI Error:', error);
        addMessage('ghost', `The connection flickered: ${error.message}. Please try again.`);
        setThinking(false, "Connection unstable", state);
        return null;
    }
}
