/**
 * Centralized LLM Service Layer for ChessMaster
 * Powered primarily by llm7.io with OpenRouter fallback support.
 */

const LLM7_BASE_URL = 'https://api.llm7.io/v1/chat/completions';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Robust JSON parser for LLM responses.
 * Extracts JSON content even if wrapped in markdown blocks or prefixed/suffixed with text.
 */
export function parseJsonResponse(rawContent) {
  if (!rawContent) return null;
  if (typeof rawContent === 'object') return rawContent;

  let cleaned = rawContent.trim();
  // Strip markdown code block wrappers
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Attempt regex extraction of the first balanced JSON object
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (innerErr) {
        console.warn('Regex JSON extraction failed:', innerErr.message);
      }
    }
  }

  return null;
}

/**
 * Execute chat completion via llm7.io with optional OpenRouter fallback.
 *
 * @param {Object} options
 * @param {Array} options.messages - Array of { role, content } messages
 * @param {string} [options.model] - Model name, defaults to process.env.LLM7_MODEL || 'default'
 * @param {number} [options.temperature=0.7]
 * @param {Object} [options.responseFormat] - e.g. { type: 'json_object' }
 * @param {number} [options.timeout=15000] - Timeout in ms
 * @returns {Promise<{ content: string, model: string, raw: Object }>}
 */
export async function chatCompletion({
  messages,
  model = process.env.LLM7_MODEL || 'default',
  temperature = 0.7,
  responseFormat,
  timeout = 15000
}) {
  const apiKey = process.env.LLM7_API_KEY || 'unused';

  // 1. Try llm7.io
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const bodyPayload = {
      model,
      messages,
      temperature
    };

    if (responseFormat) {
      bodyPayload.response_format = responseFormat;
    }

    const res = await fetch(LLM7_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || data.message?.content || data.content || '';
      return {
        content,
        model: data.model || model,
        raw: data
      };
    } else {
      const errText = await res.text().catch(() => '');
      console.warn(`llm7.io returned status ${res.status}:`, errText);
    }
  } catch (err) {
    console.warn('llm7.io request failed:', err.message);
  }

  // 2. Fallback to OpenRouter if configured
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    try {
      console.log('Falling back to OpenRouter...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const fallbackBody = {
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        messages,
        temperature
      };
      if (responseFormat) fallbackBody.response_format = responseFormat;

      const fallbackRes = await fetch(OPENROUTER_BASE_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'ChessMaster Coach',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fallbackBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (fallbackRes.ok) {
        const data = await fallbackRes.json();
        const content = data.choices?.[0]?.message?.content || '';
        return {
          content,
          model: data.model || 'openrouter-fallback',
          raw: data
        };
      }
    } catch (fbErr) {
      console.error('OpenRouter fallback failed:', fbErr.message);
    }
  }

  throw new Error('All LLM providers failed to respond.');
}
