/**
 * Direct-to-NanoGPT transport.
 *
 * Mirrors the shape of `services/agent/agentClient.ts` (POST + JSON body,
 * bearer auth, friendly network-error message) but targets NanoGPT's
 * OpenAI-compatible `/chat/completions` endpoint directly from the phone.
 *
 * This file stages the new code path; commit 3 will flip consumers
 * (streamingTransports, insights, askRosebud) over to it. Until then,
 * the agent layer remains the active path.
 */

import { getDirectConfig } from './directConfig';

export interface DirectChatRequest {
    model: string;
    messages: { role: string; content: string }[];
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
}

export interface DirectChatOptions {
    /** Override the model resolved by getDirectConfig. */
    model?: string;
    /** Extra headers to merge on top of the defaults. */
    headers?: Record<string, string>;
    /** Optional AbortSignal forwarded to fetch. */
    signal?: AbortSignal;
}

function buildUrl(apiBaseUrl: string): string {
    const base = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
    return `${base}/chat/completions`;
}

export async function fetchDirectChatCompletion(
    payload: DirectChatRequest,
    options: DirectChatOptions = {}
): Promise<Response> {
    const { apiBaseUrl, apiKey, model } = getDirectConfig();
    const url = buildUrl(apiBaseUrl);

    const body: DirectChatRequest = {
        ...payload,
        model: options.model ?? payload.model ?? model,
    };

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(options.headers ?? {}),
    };

    try {
        return await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            ...(options.signal ? { signal: options.signal } : {}),
        });
    } catch {
        throw new Error(
            `Failed to fetch: Could not connect to NanoGPT at ${url}. ` +
            'Check your network and EXPO_PUBLIC_NANO_GPT_API_BASE_URL.'
        );
    }
}

export { getDirectConfig } from './directConfig';
export { DirectConfigError } from './directConfig';
export type { DirectConfig } from './directConfig';
