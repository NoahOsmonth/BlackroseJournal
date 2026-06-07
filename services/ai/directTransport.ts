/**
 * Direct-to-NanoGPT transport.
 *
 * Targets NanoGPT's OpenAI-compatible `/chat/completions` endpoint
 * directly from the phone. The request body is intentionally filtered to
 * OpenAI-standard fields before it leaves the device.
 */

import { getDirectConfig } from './directConfig';

export interface DirectChatRequest {
    model: string;
    messages: { role: string; content: string }[];
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: 'json_object' };
}

export interface DirectChatOptions {
    /** Override the model resolved by getDirectConfig. */
    model?: string;
    /** Extra headers to merge on top of the defaults. */
    headers?: Record<string, string>;
    /** Optional AbortSignal forwarded to fetch. */
    signal?: AbortSignal;
}

interface PreparedDirectChatRequest {
    url: string;
    headers: Record<string, string>;
    body: DirectChatRequest;
}

function buildUrl(apiBaseUrl: string): string {
    const base = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
    return `${base}/chat/completions`;
}

function resolveModel(payloadModel: string | undefined, defaultModel: string): string {
    if (!payloadModel || payloadModel === 'agent-default') return defaultModel;
    return payloadModel;
}

export function prepareDirectChatRequest(
    payload: DirectChatRequest,
    options: DirectChatOptions = {}
): PreparedDirectChatRequest {
    const { apiBaseUrl, apiKey, model } = getDirectConfig();
    const url = buildUrl(apiBaseUrl);
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(options.headers ?? {}),
    };
    const body: DirectChatRequest = {
        model: options.model ?? resolveModel(payload.model, model),
        messages: payload.messages,
        stream: payload.stream,
        temperature: payload.temperature,
        max_tokens: payload.max_tokens,
        response_format: payload.response_format,
    };

    return { url, headers, body };
}

export async function fetchDirectChatCompletion(
    payload: DirectChatRequest,
    options: DirectChatOptions = {}
): Promise<Response> {
    const request = prepareDirectChatRequest(payload, options);
    try {
        return await fetch(request.url, {
            method: 'POST',
            headers: request.headers,
            body: JSON.stringify(request.body),
            ...(options.signal ? { signal: options.signal } : {}),
        });
    } catch {
        throw new Error(
            `Failed to fetch: Could not connect to NanoGPT at ${request.url}. ` +
            'Check your network and EXPO_PUBLIC_NANO_GPT_API_BASE_URL.'
        );
    }
}

export { getDirectConfig } from './directConfig';
export { DirectConfigError } from './directConfig';
export type { DirectConfig } from './directConfig';
