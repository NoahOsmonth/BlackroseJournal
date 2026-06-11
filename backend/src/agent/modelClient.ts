/**
 * PR4 — modelClient thin wrapper.
 *
 * `agentService.ts` and `askRosebudService.ts` call these two functions
 * with the messages + a small options bag. The wrapper resolves the
 * server-side profile (v1: always 'default') and delegates to the
 * provider layer introduced in PR3. No fetch / no env reads here.
 *
 * Client-supplied `model` is intentionally ignored in v1. Profile
 * resolution is server-side only; the request body is treated as
 * untrusted.
 */
import { getProviderForProfile } from '../services/ai';
import type { ChatRequest, ChatResponse, ResolvedProfile } from '../services/ai/provider';
import type { ChatMessage } from './types';

export interface ChatCompletionOptions {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    model?: string;
}

function resolveServerProfile(): ResolvedProfile {
    return getProviderForProfile('default').resolveProfile('default');
}

function buildRequest(
    messages: ChatMessage[],
    options: ChatCompletionOptions,
    stream: boolean
): ChatRequest {
    const req: ChatRequest = { messages, stream };
    if (options.temperature !== undefined) req.temperature = options.temperature;
    if (options.topP !== undefined) req.topP = options.topP;
    if (options.maxTokens !== undefined) req.maxTokens = options.maxTokens;
    return req;
}

export async function createChatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
): Promise<{ content: string; reasoning: string }> {
    const profile = resolveServerProfile();
    const response: ChatResponse = await getProviderForProfile('default').chat(
        buildRequest(messages, options, false),
        profile
    );
    return { content: response.content, reasoning: response.reasoning };
}

export async function createChatCompletionStream(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
): Promise<Response> {
    const profile = resolveServerProfile();
    return getProviderForProfile('default').stream(
        buildRequest(messages, options, true),
        profile
    );
}

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
