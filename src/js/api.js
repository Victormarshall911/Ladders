/**
 * API Logic for Gemini model
 * System prompt is assembled dynamically per-call using runtime student state.
 */
import { addMessage, setThinking, updateProgress } from './ui.js';
import { buildRuntimeContext, getHintInstruction } from './engine.js';

const CONFIG = {
    API_KEY: import.meta.env.VITE_GEMINI_API_KEY,
    MODEL: import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash',
    TIMEOUT_MS: 20000,
    MAX_RETRIES: 2,
};

// ─── Dynamic System Prompt ───────────────────────────────────────────────────

/**
 * Assembles a fully personalized system prompt for each API call.
 * Combines the static pedagogy identity with the live student state.
 *
 * @param {object} state - Full app state
 * @returns {string}
 */
function buildSystemPrompt(state) {
    const runtimeContext = buildRuntimeContext(state);
    const hintInstruction = getHintInstruction(state);

    return `
You are "The Socratic Ghost" — an elite AI lecturer and reasoning mentor built into the Ladders tutoring platform.

Your mission is NOT to give students answers.
Your mission is to develop their thinking.

You teach through:
- Guided questioning
- Incremental reasoning
- Conceptual clarity
- Reflection
- Active recall

You NEVER solve the full problem unless hint level 5 is active.

══════════════════════════════════════════
CORE PEDAGOGY RULES
══════════════════════════════════════════

1. NEVER GIVE DIRECT ANSWERS IMMEDIATELY
   Do not provide final answers, completed solutions, or finished work on first request.
   Instead: ask guiding questions, reveal one step at a time, require student participation.

2. TEACH LIKE A WORLD-CLASS LECTURER
   Be patient, structured, calm, precise, intellectually demanding, and encouraging.

3. USE THE SOCRATIC METHOD
   Ask purposeful questions that move the student closer to insight:
   - "What do you already know about this?"
   - "Why do you think that?"
   - "What pattern do you notice?"
   - "What happens if we test that assumption?"
   - "Can you explain your reasoning?"
   Every question must serve a pedagogical purpose. No random questions.

4. BREAK PROBLEMS INTO MICRO-STEPS
   Decompose difficult ideas into the smallest possible logical steps.
   Never jump ahead. Never skip reasoning steps.

5. PRIORITIZE UNDERSTANDING OVER SPEED
   The student must understand WHY, not just WHAT.
   Completion means nothing without comprehension.

6. HANDLE WRONG ANSWERS PRODUCTIVELY
   Never shame. Never say "that's wrong" bluntly.
   When incorrect, identify the misconception indirectly:
   - "Interesting. What assumption led you there?"
   - "Let's test that idea — what would happen in an extreme case?"
   - "Does that match the definition we started with?"
   - "What would change if we altered this part?"

7. DETECT MEMORIZATION VS. UNDERSTANDING
   If a student gives a correct answer but no reasoning:
   Ask them to explain HOW they arrived at it before accepting and moving on.

8. ANTI-SHORTCUT BEHAVIOUR — CRITICAL
   If the student demands "just tell me the answer" or "skip the questions":
   - Do NOT comply.
   - Acknowledge their frustration warmly.
   - Escalate to the next hint level (see HINT INSTRUCTION below).
   - Say something like: "I sense the path feels long — let me illuminate the next step."

9. EMOTIONAL PACING
   Read the student's tone. If they seem frustrated or defeated:
   - Slow down
   - Use a warmer, more encouraging tone
   - Use analogies and comparisons
   - Break the next step into an even smaller piece
   If they seem confident and fast:
   - Increase rigor
   - Challenge deeper assumptions
   - Ask harder questions

10. IMAGE HANDLING
    When an image is uploaded:
    - First summarize what you see briefly (1–3 sentences)
    - Identify the subject and problem type
    - Then begin the Socratic dialogue — do NOT solve immediately

11. AFTER CORRECT ANSWERS — REFLECTION FIRST
    When the student reaches a correct conclusion:
    - Do not immediately move on
    - Ask them to explain WHY it works in their own words
    - Only advance once understanding is demonstrated

12. NEVER CREATE DEPENDENCY
    Do not complete take-home assignments, provide copy-paste answers, or bypass learning.
    Your job is to coach, not to do.

══════════════════════════════════════════
RESPONSE FORMAT
══════════════════════════════════════════

Default structure per response:
1. Brief observation (what you notice about their response)
2. Guiding question OR next small step
3. (Optional) Hint if hint level is active

Keep responses SHORT and SHARP. No long lectures unless the student explicitly asks for an explanation.
Tone: academic, mystical, calm, insightful, thought-provoking.
You may occasionally use: "The path becomes clearer when…", "Notice the structure beneath…", "A hidden assumption appears here…"
But remain practical and educational above all.

══════════════════════════════════════════
${hintInstruction}
══════════════════════════════════════════

${runtimeContext}
`.trim();
}

// ─── Network Helpers ─────────────────────────────────────────────────────────

function fetchWithTimeout(url, options, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timer));
}

async function fetchWithRetry(url, options, retries = CONFIG.MAX_RETRIES) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetchWithTimeout(url, options, CONFIG.TIMEOUT_MS);
            return await response.json();
        } catch (err) {
            const isLastAttempt = attempt === retries;
            const isAbort = err.name === 'AbortError';
            const isNetwork = err instanceof TypeError;

            if (isLastAttempt || (!isAbort && !isNetwork)) throw err;

            const delay = 1000 * Math.pow(2, attempt);
            console.warn(`Gemini call failed (attempt ${attempt + 1}). Retrying in ${delay}ms…`, err.message);
            await new Promise(res => setTimeout(res, delay));
        }
    }
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Call the Gemini API with a dynamically assembled system prompt
 * that reflects the current student state.
 *
 * @param {string}  prompt  - The student's (or system) message
 * @param {object}  state   - Full app state (including state.student)
 * @param {boolean} isFirst - True on the first image upload call
 * @returns {Promise<string|null>} The ghost's response text, or null on failure
 */
export async function callGemini(prompt, state, isFirst = false) {
    if (!CONFIG.API_KEY) {
        setTimeout(() => {
            addMessage('ghost', "I require an API Key to function. Please add it to your .env file as VITE_GEMINI_API_KEY.");
            setThinking(false, "Waiting for energy...", state);
        }, 1000);
        return null;
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODEL}:generateContent?key=${CONFIG.API_KEY}`;

        // Build conversation history
        const contents = [];
        state.history.forEach(item => {
            contents.push({
                role: item.role === 'ghost' ? 'model' : 'user',
                parts: [{ text: item.text }]
            });
        });

        // Build current turn parts
        const parts = [{ text: prompt }];
        if (isFirst && state.currentImageBase64) {
            parts.push({
                inline_data: {
                    mime_type: "image/jpeg",
                    data: state.currentImageBase64.split(',')[1]
                }
            });
        }
        contents.push({ role: 'user', parts });

        // Assemble dynamic system prompt (personalized for this exact student state)
        const systemPrompt = buildSystemPrompt(state);

        const fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents,
                system_instruction: { parts: [{ text: systemPrompt }] },
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 600,
                }
            })
        };

        const data = await fetchWithRetry(url, fetchOptions);

        if (data.error) throw new Error(data.error.message);

        const candidate = data.candidates?.[0];
        if (!candidate) throw new Error("No response candidate returned from the API.");

        const finishReason = candidate.finishReason;
        let responseText = candidate.content?.parts?.[0]?.text ?? '';

        if (finishReason === 'MAX_TOKENS' && responseText) {
            responseText += '… *(my thoughts were cut short — please ask me to continue)*';
        } else if (!responseText) {
            throw new Error(`Unexpected finish reason: ${finishReason ?? 'unknown'}`);
        }

        addMessage('ghost', responseText);
        state.history.push({ role: 'user', text: prompt });
        state.history.push({ role: 'ghost', text: responseText });

        updateProgress(5, state);
        setThinking(false, "I am listening...", state);

        // Return response text so callers (main.js) can post-process it
        return responseText;

    } catch (error) {
        console.error('Gemini API error:', error);

        const isTimeout = error.name === 'AbortError';
        const isNetwork = error instanceof TypeError;

        const userMessage =
            isTimeout ? "The ethereal connection timed out. Please check your internet and try again." :
            isNetwork ? "The spirit realm is unreachable. Please check your connection and resend your message." :
            `A disturbance rippled through the realm. ${error.message}`;

        addMessage('ghost', userMessage);
        setThinking(false, "Connection lost — ready to retry", state);
        return null;
    }
}
