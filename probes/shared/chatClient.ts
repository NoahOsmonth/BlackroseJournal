/**
 * Probe-only OpenAI-compatible chat client.
 * Uses the same env key/base as the app (applyProbeEnv first).
 * Does not import app UI; thin fetch for design measurements.
 */

export interface ChatUsage {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    [key: string]: unknown;
}

export interface ChatMessage {
    role: string;
    content: string | null;
    tool_calls?: unknown;
    tool_call_id?: string;
    name?: string;
}

export interface ChatCompletionResult {
    ok: boolean;
    status: number;
    body: unknown;
    usage: ChatUsage | null;
    rawText: string;
    model: string;
    errorTaxonomy: 'ok' | 'format_rejection_400_422' | 'auth_401' | 'rate_limit_429' | 'network' | 'other';
}

export interface ChatRequestOptions {
    model: string;
    messages: ChatMessage[];
    tools?: unknown[];
    tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    temperature?: number;
    max_tokens?: number;
    apiKey: string;
    apiBaseUrl: string;
}

/** Reuse jsonCompletion taxonomy: 400/422 format-rejection vs 401/429/network. */
export function classifyHttpError(status: number, bodyText: string): ChatCompletionResult['errorTaxonomy'] {
    if (status === 401) return 'auth_401';
    if (status === 429) return 'rate_limit_429';
    if (status === 400 || status === 422) {
        const lower = bodyText.toLowerCase();
        if (
            lower.includes('json_object')
            || lower.includes('response_format')
            || lower.includes('invalid_request_body')
            || lower.includes('tools')
            || lower.includes('tool')
        ) {
            return 'format_rejection_400_422';
        }
        return 'format_rejection_400_422';
    }
    return 'other';
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

export async function chatCompletion(
    opts: ChatRequestOptions,
    retries = 3,
): Promise<ChatCompletionResult> {
    const url = `${opts.apiBaseUrl.replace(/\/+$/, '')}/chat/completions`;
    const payload: Record<string, unknown> = {
        model: opts.model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.max_tokens ?? 1024,
        stream: false,
    };
    if (opts.tools && opts.tools.length > 0) {
        payload.tools = opts.tools;
        payload.tool_choice = opts.tool_choice ?? 'auto';
    }

    let lastNetwork: unknown;
    for (let attempt = 0; attempt < retries; attempt += 1) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: `Bearer ${opts.apiKey}`,
                    'HTTP-Referer': 'https://blackrosejournal.app',
                    'X-Title': 'Blackrose Journal PROBE_LLM',
                },
                body: JSON.stringify(payload),
            });
            const rawText = await response.text();
            let body: unknown = null;
            try {
                body = JSON.parse(rawText);
            } catch {
                body = { parse_error: true, raw: rawText.slice(0, 500) };
            }

            if (response.status === 429 && attempt < retries - 1) {
                const backoff = 1500 * 2 ** attempt + Math.floor(Math.random() * 400);
                await sleep(backoff);
                continue;
            }

            const usage = (
                body && typeof body === 'object' && 'usage' in body
                    ? (body as { usage?: ChatUsage }).usage ?? null
                    : null
            );

            if (response.ok) {
                return {
                    ok: true,
                    status: response.status,
                    body,
                    usage,
                    rawText,
                    model: opts.model,
                    errorTaxonomy: 'ok',
                };
            }

            return {
                ok: false,
                status: response.status,
                body,
                usage,
                rawText,
                model: opts.model,
                errorTaxonomy: classifyHttpError(response.status, rawText),
            };
        } catch (err) {
            lastNetwork = err;
            if (attempt < retries - 1) {
                await sleep(1000 * 2 ** attempt);
                continue;
            }
        }
    }

    return {
        ok: false,
        status: 0,
        body: { error: String(lastNetwork) },
        usage: null,
        rawText: String(lastNetwork),
        model: opts.model,
        errorTaxonomy: 'network',
    };
}

export function extractAssistantMessage(body: unknown): {
    content: string;
    tool_calls: {
        id: string;
        type: string;
        function: { name: string; arguments: string };
    }[];
} {
    if (!body || typeof body !== 'object') return { content: '', tool_calls: [] };
    const choices = (body as { choices?: unknown }).choices;
    if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') {
        return { content: '', tool_calls: [] };
    }
    const message = (choices[0] as { message?: Record<string, unknown> }).message ?? {};
    const content = typeof message.content === 'string' ? message.content : '';
    const rawCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    const tool_calls = rawCalls
        .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
        .map((c, i) => {
            const fn = (c.function && typeof c.function === 'object'
                ? c.function
                : {}) as { name?: string; arguments?: string };
            return {
                id: typeof c.id === 'string' ? c.id : `call_${i}`,
                type: typeof c.type === 'string' ? c.type : 'function',
                function: {
                    name: typeof fn.name === 'string' ? fn.name : '',
                    arguments: typeof fn.arguments === 'string'
                        ? fn.arguments
                        : JSON.stringify(fn.arguments ?? {}),
                },
            };
        });
    return { content, tool_calls };
}
