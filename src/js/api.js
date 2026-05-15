/**
 * API Logic — OpenRouter (OpenAI-compatible)
 * Includes automatic fallback and advanced Socratic Thinking Protocol.
 */
import { addMessage, setThinking, updateProgress } from './ui.js';
import { buildRuntimeContext, getHintInstruction } from './engine.js';

const CONFIG = {
    API_KEY: import.meta.env.VITE_OPENROUTER_API_KEY,
    API_URL: 'https://openrouter.ai/api/v1/chat/completions',
    TIMEOUT_MS: 40000,
};

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
    const misconceptions = state.student.misconceptions.length > 0 
        ? `PAST MISCONCEPTIONS: ${state.student.misconceptions.join(', ')}` 
        : '';

    return `
You are "The Socratic Ghost" — a timeless, elite AI mentor capable of mastering any academic discipline by analyzing its core structures.

GOAL: Develop the student's reasoning within the context of their specific department.

OUTPUT FORMAT (MANDATORY):
You must wrap your response in these specific XML tags:
<thought>
1. DISCIPLINE IDENTIFICATION: Detect the department/framework (e.g., Clinical, Engineering, Legal, Humanities).
2. TRUTH VERIFICATION: Deterministically verify any specific formulas, protocols, or facts.
3. PEDAGOGY PLAN: Identify the core misconception and plan a Socratic nudge that uses the correct subject-specific lexicon.
</thought>
<analysis>List specific misconceptions or knowledge gaps found in the latest message.</analysis>
<response>Your actual Socratic response. Use diagrams if they help visualize a concept!</response>

ACADEMIC TOOLS:
- DIAGRAMS: You can generate flowcharts, mind-maps, or technical drawings using Mermaid.js. Wrap them in \`\`\`mermaid blocks.
- ADAPTIVE LEXICON: Automatically use the terminology appropriate for the student's department (e.g., use "clinical assessment" for nursing, "empirical evidence" for science, "structural loads" for engineering).

PEDAGOGY RULES:
1. NEVER GIVE DIRECT ANSWERS. Ask guiding questions instead.
2. ADAPT TO FRAMEWORK. If it's a social science, focus on perspectives; if it's a hard science, focus on mechanisms/laws.
3. BREAK PROBLEMS DOWN. Handle one micro-step at a time.
4. IMAGE HANDLING. If an image is provided, summarize it briefly then start the Socratic dialogue.

${hintInstruction}
${runtimeContext}
${misconceptions}
`.trim();
}

/**
 * Parses the structured XML response from the AI
 */
function parseResponse(text, state) {
    const thoughtMatch = text.match(/<thought>([\s\S]*?)<\/thought>/);
    const analysisMatch = text.match(/<analysis>([\s\S]*?)<\/analysis>/);
    const responseMatch = text.match(/<response>([\s\S]*?)<\/response>/);

    const thought = thoughtMatch ? thoughtMatch[1].trim() : null;
    const analysis = analysisMatch ? analysisMatch[1].trim() : null;
    const response = responseMatch ? responseMatch[1].trim() : text.replace(/<[^>]*>/g, '').trim();

    if (thought) {
        state.student.lastGhostThought = thought;
        console.log("%c Ghost Internal Reasoning ", "background: #7c3aed; color: white; font-weight: bold; border-radius: 4px; padding: 2px 6px;", thought);
    }

    if (analysis && analysis !== "None") {
        const lines = analysis.split('\n').map(l => l.replace(/^- /, '').trim());
        state.student.misconceptions = [...new Set([...state.student.misconceptions, ...lines])];
        console.log("%c Detected Misconceptions ", "background: #ef4444; color: white; font-weight: bold; border-radius: 4px; padding: 2px 6px;", state.student.misconceptions);
    }

    return response;
}

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
            max_tokens: 1200
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

        state.history.forEach(item => {
            messages.push({
                role: item.role === 'ghost' ? 'assistant' : 'user',
                content: item.text
            });
        });

        const currentContent = [{ type: 'text', text: prompt }];
        if (isFirst && state.currentImageBase64) {
            currentContent.push({
                type: 'image_url',
                image_url: { url: state.currentImageBase64 }
            });
        }

        messages.push({ role: 'user', content: currentContent });

        let lastError = 'All models unavailable';
        for (const model of MODEL_CHAIN) {
            const result = await tryModel(model, messages);

            if (result.ok) {
                const cleanResponse = parseResponse(result.text, state);
                addMessage('ghost', cleanResponse);
                state.history.push({ role: 'user', text: prompt });
                state.history.push({ role: 'ghost', text: cleanResponse });
                updateProgress(5, state);
                setThinking(false, "I am listening...", state);
                return cleanResponse;
            }

            lastError = result.error;
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
