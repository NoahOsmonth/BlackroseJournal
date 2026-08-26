/**
 * Shared JSON flash-completion helper for extraction / insights.
 *
 * Many free models (e.g. tencent/hy3) reject `response_format: json_object`
 * with HTTP 400 while still returning usable freeform JSON when that field
 * is omitted. Call sites MUST use this helper instead of wiring
 * response_format directly onto fetchDirectChatCompletion — one place owns
 * the structured → freeform fallback so model swaps cannot reintroduce
 * silent extract failures.
 *
 * Flow:
 *   1. Prefer structured mode when the model is not known to reject it.
 *   2. On 400/422 (or explicit response_format rejection text), retry the
 *      SAME request without response_format.
 *   3. Return raw message content; callers parse + schema-validate and fail
 *      closed on garbage (this helper does not write any store).
 *
 * Per-model "rejects json_object" memory is an optimization only — the
 * freeform fallback always remains available.
 */

import { fetchAiChatCompletion } from './aiTransport';
import type { DirectChatOptions, DirectChatRequest } from './directTransport';

export interface JsonCompletionRequest {
    model?: string;
    messages: DirectChatRequest['messages'];
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
}

export interface JsonCompletionResult {
    /** Assistant message content (may wrap JSON in prose/fences). */
    content: string;
    /** True when the successful attempt used response_format. */
    usedResponseFormat: boolean;
    /** Cache / diagnostic key for the attempt. */
    model: string;
}

/** In-session keys known to reject response_format json_object. */
const modelsRejectingJsonObject = new Set<string>();

/** Test seam: clear per-model support cache. */
export function resetJsonCompletionStateForTests(): void {
    modelsRejectingJsonObject.clear();
}

/** Test seam: pretreat a model key as rejecting structured mode. */
export function markModelRejectsJsonObjectForTests(modelId: string): void {
    modelsRejectingJsonObject.add(modelId);
}

/**
 * Stable cache key without resolving live config (keeps unit tests free of
 * AsyncStorage / custom-provider dynamic imports).
 */
function cacheKeyFor(payload: JsonCompletionRequest, options: DirectChatOptions): string {
    if (options.model) return options.model;
    if (payload.model && payload.model !== 'agent-default') return payload.model;
    return options.modelPurpose === 'flash' ? 'flash:agent-default' : 'default:agent-default';
}

/**
 * Pull the first balanced `{...}` object from freeform model text.
 * Shared so call sites do not re-implement fence/prose stripping.
 */
export function extractFirstJsonObject(text: string): string | null {
    const start = text.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    for (let i = start; i < text.length; i += 1) {
        const ch = text[i];
        if (ch === '{') depth += 1;
        if (ch === '}') depth -= 1;
        if (depth === 0) return text.slice(start, i + 1);
    }
    return null;
}

/** Parse JSON from model text (structured or freeform). Null on failure. */
export function parseJsonFromModelText<T = unknown>(raw: string): T | null {
    const jsonText = extractFirstJsonObject(raw) ?? raw;
    try {
        return JSON.parse(jsonText) as T;
    } catch {
        return null;
    }
}

function shouldFallbackToFreeform(status: number, body: string): boolean {
    if (status === 400 || status === 422) return true;
    const lower = body.toLowerCase();
    return (
        lower.includes('json_object')
        || lower.includes('response_format')
        || lower.includes('invalid_request_body')
    );
}

async function readMessageContent(response: Response): Promise<string> {
    const json = (await response.json()) as {
        choices?: { message?: { content?: string | null } }[];
    };
    return json.choices?.[0]?.message?.content ?? '';
}

/**
 * Flash/default chat completion that prefers json_object mode, then freeform.
 * Throws on hard transport failures (both modes failed / non-retryable error).
 */
export async function fetchDirectJsonCompletion(
    payload: JsonCompletionRequest,
    options: DirectChatOptions = {},
): Promise<JsonCompletionResult> {
    const base: DirectChatRequest = {
        model: payload.model ?? 'agent-default',
        messages: payload.messages,
        temperature: payload.temperature,
        top_p: payload.top_p,
        max_tokens: payload.max_tokens,
        stream: false,
    };

    const modelKey = cacheKeyFor(payload, options);
    const skipStructured = modelsRejectingJsonObject.has(modelKey);

    if (!skipStructured) {
        const structured = await fetchAiChatCompletion(
            { ...base, response_format: { type: 'json_object' } },
            options,
        );
        if (structured.ok) {
            return {
                content: await readMessageContent(structured),
                usedResponseFormat: true,
                model: modelKey,
            };
        }
        const preview = await structured.text().catch(() => '');
        if (shouldFallbackToFreeform(structured.status, preview)) {
            modelsRejectingJsonObject.add(modelKey);
            // Continue to freeform — do not throw yet.
        } else {
            throw new Error(
                `JSON completion failed (${structured.status}). ${preview.slice(0, 200)}`,
            );
        }
    }

    const freeform = await fetchAiChatCompletion(base, options);
    if (!freeform.ok) {
        const preview = await freeform.text().catch(() => '');
        console.warn(
            `[jsonCompletion] BOTH structured and freeform failed for ${modelKey} `
            + `(freeform HTTP ${freeform.status}). Extract callers will fail closed. `
            + `body=${preview.slice(0, 160)}`,
        );
        throw new Error(
            `JSON completion freeform failed (${freeform.status}). ${preview.slice(0, 200)}`,
        );
    }
    const content = await readMessageContent(freeform);
    // Transport succeeded; callers schema-validate. Surface empty/unparseable freeform
    // so silent extract nulls are visible in logs (no return-shape change).
    if (!content.trim() || extractFirstJsonObject(content) === null) {
        console.warn(
            `[jsonCompletion] freeform fallback for ${modelKey} returned no parseable JSON object `
            + `(len=${content.length}). Callers must fail closed with no store write.`,
        );
    }
    return {
        content,
        usedResponseFormat: false,
        model: modelKey,
    };
}
