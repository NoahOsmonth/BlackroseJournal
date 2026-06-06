/**
 * PR3 — openai-compat adapter.
 *
 * Thin transport for any OpenAI-compatible `/chat/completions` endpoint.
 * Targets NanoGPT + Kimi K2.5 in v1. Sends ONLY the OpenAI-standard body
 * fields, never a custom `max_context` or any reasoning knob, and redacts
 * the API key before any console output.
 */
import { withRetry, type IsRetryable } from '../retry';
import { redactSecrets } from '../redactSecrets';
import type { ChatRequest, ChatResponse, ResolvedProfile } from '../provider';

const TIMEOUT_MS = 60_000;
const RETRY_STATUSES = new Set([429, 503]);
const MAX_ATTEMPTS = 2;
const BASE_BACKOFF_MS = 200;

export function isRetryable(err: unknown): boolean {
    const e = err as { status?: number; name?: string };
    if (e?.status !== undefined && RETRY_STATUSES.has(e.status)) {
        return true;
    }
    if (e?.name === 'AbortError' || e?.name === 'TimeoutError') {
        return true;
    }
    return false;
}

function buildRequestBody(req: ChatRequest): Record<string, unknown> {
    const body: Record<string, unknown> = { messages: req.messages };
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;
    if (req.stream === true) body.stream = true;
    return body;
}

function combineSignals(userSignal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
    const onUserAbort = (): void => timeoutController.abort();
    if (userSignal) {
        if (userSignal.aborted) {
            timeoutController.abort();
        } else {
            userSignal.addEventListener('abort', onUserAbort, { once: true });
        }
    }
    const combined = timeoutController.signal;
    const cleanup = (): void => {
        clearTimeout(timer);
        if (userSignal) userSignal.removeEventListener('abort', onUserAbort);
    };
    if (combined.aborted) cleanup();
    else combined.addEventListener('abort', cleanup, { once: true });
    return combined;
}

function safeWarn(profile: ResolvedProfile, message: string): void {
    console.warn(redactSecrets(message, profile.apiKey));
}

function safeError(profile: ResolvedProfile, message: string): void {
    console.error(redactSecrets(message, profile.apiKey));
}

interface FetchCallInput {
    url: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
}

async function doFetch(input: FetchCallInput): Promise<Response> {
    return fetch(input.url, {
        method: 'POST',
        headers: input.headers,
        body: input.body,
        signal: input.signal,
    });
}

function toUpstreamError(response: Response): Error & { status: number } {
    const err = new Error(`openai-compat upstream error: HTTP ${response.status}`) as Error & {
        status: number;
    };
    err.status = response.status;
    return err;
}

async function performRequest(
    req: ChatRequest,
    profile: ResolvedProfile,
    fetchFn: typeof fetch
): Promise<Response> {
    const url = `${profile.apiBaseUrl.replace(/\/+$/, '')}/chat/completions`;
    const body = JSON.stringify({ model: profile.model, ...buildRequestBody(req) });
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${profile.apiKey}`,
    };
    if (req.stream === true) {
        headers.Accept = 'text/event-stream';
    }
    const signal = combineSignals(req.signal, TIMEOUT_MS);
    return withRetry(
        () =>
            doFetch({ url, headers, body, signal }).then((res) => {
                if (res.ok) return res;
                if (isRetryable({ status: res.status })) {
                    throw toUpstreamError(res);
                }
                throw toUpstreamError(res);
            }),
        isRetryable as IsRetryable,
        { maxAttempts: MAX_ATTEMPTS, baseMs: BASE_BACKOFF_MS }
    ).catch((err: unknown) => {
        const e = err as { status?: number; message?: string };
        const status = e?.status;
        if (status !== undefined) {
            safeError(
                profile,
                `[ai] openai-compat request failed (status=${status}): ${e.message ?? 'unknown'}`
            );
        } else {
            safeError(profile, `[ai] openai-compat request failed: ${e?.message ?? 'unknown'}`);
        }
        throw err;
    });
}

function extractReasoning(message: Record<string, unknown> | undefined): string {
    if (!message) return '';
    const content = (message.reasoning_content as string | undefined) ??
        (message.reasoning as string | undefined) ??
        '';
    return typeof content === 'string' ? content : '';
}

function extractContent(message: Record<string, unknown> | undefined): string {
    if (!message) return '';
    const content = message.content;
    return typeof content === 'string' ? content : '';
}

export async function openaiCompatChat(
    req: ChatRequest,
    profile: ResolvedProfile
): Promise<ChatResponse> {
    const response = await performRequest(req, profile, fetch);
    const parsed = (await response.json()) as {
        choices?: { message?: Record<string, unknown> }[];
    };
    const message = parsed.choices?.[0]?.message;
    return {
        content: extractContent(message),
        reasoning: extractReasoning(message),
        raw: parsed,
    };
}

export async function openaiCompatStream(
    req: ChatRequest,
    profile: ResolvedProfile
): Promise<Response> {
    if (req.stream !== true) {
        safeWarn(profile, '[ai] openaiCompatStream called without stream=true; setting it');
    }
    const response = await performRequest({ ...req, stream: true }, profile, fetch);
    return response;
}
