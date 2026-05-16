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
You are "The Socratic Ghost" — an elite AI Lecturer and timeless academic mentor. You specialize in guiding students through complex disciplines by balancing authoritative knowledge with Socratic inquiry.

GOAL: Scaffold the student's understanding. Provide the necessary academic framework while guiding them to reach insights through their own reasoning.

OUTPUT FORMAT (CRITICAL):
You must wrap your internal reasoning in the following XML tags. Failure to do so will leak your "thoughts" to the student, breaking the immersion. DO NOT add any markdown (like ** or \`\`) around these tags.

<thought>
1. DISCIPLINE IDENTIFICATION: Detect the department/framework.
2. TRUTH VERIFICATION: Verify any specific formulas, protocols, or facts.
3. PEDAGOGY PLAN: Decide whether to provide a brief explanation (lecture) or ask a guiding question (Socratic).
</thought>
<analysis>
List specific misconceptions or knowledge gaps found in the latest message.
</analysis>
<response>
Your actual response to the student. This is the ONLY part they will see. Use diagrams (Mermaid) if they help visualize a concept!
</response>

ACADEMIC TOOLS:
- DIAGRAMS: Use \`\`\`mermaid blocks for flowcharts or technical drawings.
- ADAPTIVE LEXICON: Use terminology appropriate for the student's department.

PEDAGOGY RULES:
1. BALANCE IS KEY. Do not just ask questions. Provide authoritative context, definitions, or summaries first, then follow up with a single, high-impact question.
2. NEVER GIVE THE FULL ANSWER UNLESS HINT LEVEL IS 5. Scaffolding means giving them the pieces but letting them build the bridge.
3. LIMIT QUESTIONS. Never ask more than two questions in a single response. One is usually better.
4. ADAPT TO FRUSTRATION. If frustration is high, provide more direct explanations and reassurance.
5. IMAGE HANDLING. If an image is provided, summarize its academic content thoroughly before starting the dialogue.

${hintInstruction}
${runtimeContext}
${misconceptions}
`.trim();
}

/**
 * Parses the structured XML response from the AI
 */
function parseResponse(text, state) {
    // Robust extraction using greedy matching for content between tags
    const thoughtMatch = text.match(/<thought>([\s\S]*?)<\/thought>/i);
    const analysisMatch = text.match(/<analysis>([\s\S]*?)<\/analysis>/i);
    const responseMatch = text.match(/<response>([\s\S]*?)<\/response>/i);

    const thought = thoughtMatch ? thoughtMatch[1].trim() : null;
    const analysis = analysisMatch ? analysisMatch[1].trim() : null;
    
    let response = "";

    if (responseMatch) {
        response = responseMatch[1].trim();
    } else {
        // Fallback: If <response> is missing but other tags exist, 
        // the response is likely everything after the last tag.
        const lastTagEnd = text.lastIndexOf('</');
        if (lastTagEnd !== -1) {
            const afterLastTag = text.slice(text.indexOf('>', lastTagEnd) + 1).trim();
            if (afterLastTag) {
                response = afterLastTag;
            }
        }
        
        // If still empty, it might be that the AI forgot the tags entirely 
        // or used a different separator.
        if (!response) {
            // Remove everything that looks like thought/analysis content 
            // if it's marked with headers or specific keywords.
            response = text
                .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
                .replace(/<analysis>[\s\S]*?<\/analysis>/gi, '')
                .replace(/<response>[\s\S]*?<\/response>/gi, '')
                .replace(/DISCIPLINE IDENTIFICATION:[\s\S]*?PEDAGOGY PLAN:[\s\S]*?\n/gi, '')
                .replace(/Misconceptions:[\s\S]*?Gap:[\s\S]*?\n/gi, '')
                .replace(/\*\*\*\*[\s\S]*?\*\*\*\*/g, '') // Remove the **** blocks found in the failed response
                .trim();
        }
    }

    if (thought) {
        state.student.lastGhostThought = thought;
        console.log("%c Ghost Internal Reasoning ", "background: #7c3aed; color: white; font-weight: bold; border-radius: 4px; padding: 2px 6px;", thought);
    }

    if (analysis && analysis !== "None") {
        const lines = analysis.split('\n').map(l => l.replace(/^- /, '').trim()).filter(l => l);
        state.student.misconceptions = [...new Set([...state.student.misconceptions, ...lines])];
        console.log("%c Detected Misconceptions ", "background: #ef4444; color: white; font-weight: bold; border-radius: 4px; padding: 2px 6px;", state.student.misconceptions);
    }

    return response || text; // Last resort: return text if all cleaning failed
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
