/**
 * Direct-to-NanoGPT transport.
 *
 * Targets NanoGPT's OpenAI-compatible `/chat/completions` endpoint
 * directly from the phone. The request body is intentionally filtered to
 * OpenAI-standard fields before it leaves the device.
 */

import { getResolvedDirectConfig, type ResolvedDirectConfig } from './directConfig';

export interface DirectChatRequest {
    model: string;
    messages: { role: string; content: string }[];
    stream?: boolean;
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    response_format?: { type: 'json_object' };
}

export interface DirectChatOptions {
    /** Override the model resolved by getDirectConfig. */
    model?: string;
    /** Use the lower-latency model when the active provider exposes one. */
    modelPurpose?: 'default' | 'flash';
    /** Extra headers to merge on top of the defaults. */
    headers?: Record<string, string>;
    /** Optional AbortSignal forwarded to fetch. */
    signal?: AbortSignal;
}

interface PreparedDirectChatRequest {
    url: string;
    headers: Record<string, string>;
    body: DirectChatRequest;
    configSource: ResolvedDirectConfig['source'];
}

function buildUrl(apiBaseUrl: string): string {
    const base = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
    return `${base}/chat/completions`;
}

function resolveDefaultModel(config: ResolvedDirectConfig, purpose: DirectChatOptions['modelPurpose']): string {
    return purpose === 'flash' ? config.flashModel : config.model;
}

function resolveModel(
    payloadModel: string | undefined,
    config: ResolvedDirectConfig,
    purpose: DirectChatOptions['modelPurpose']
): string {
    const defaultModel = resolveDefaultModel(config, purpose);
    if (config.source === 'custom') return defaultModel;
    if (!payloadModel || payloadModel === 'agent-default') return defaultModel;
    return payloadModel;
}

function buildConnectionError(request: PreparedDirectChatRequest, source: ResolvedDirectConfig['source']): Error {
    const provider = source === 'custom' ? 'custom AI provider' : 'NanoGPT';
    const setting = source === 'custom'
        ? 'the custom Base URL in Settings'
        : 'EXPO_PUBLIC_NANO_GPT_API_BASE_URL';
    return new Error(
        `Failed to fetch: Could not connect to ${provider} at ${request.url}. ` +
        `Check your network and ${setting}.`
    );
}

export async function prepareDirectChatRequest(
    payload: DirectChatRequest,
    options: DirectChatOptions = {}
): Promise<PreparedDirectChatRequest> {
    const config = await getResolvedDirectConfig();
    const url = buildUrl(config.apiBaseUrl);
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: payload.stream ? 'text/event-stream' : 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        ...(options.headers ?? {}),
    };
    const body: DirectChatRequest = {
        model: options.model ?? resolveModel(payload.model, config, options.modelPurpose),
        messages: payload.messages,
        stream: payload.stream,
        temperature: payload.temperature,
        top_p: payload.top_p,
        max_tokens: payload.max_tokens,
        response_format: payload.response_format,
    };

    return { url, headers, body, configSource: config.source };
}

export async function fetchDirectChatCompletion(
    payload: DirectChatRequest,
    options: DirectChatOptions = {}
): Promise<Response> {
    const request = await prepareDirectChatRequest(payload, options);
    try {
        return await fetch(request.url, {
            method: 'POST',
            headers: request.headers,
            body: JSON.stringify(request.body),
            ...(options.signal ? { signal: options.signal } : {}),
        });
    } catch {
        throw buildConnectionError(request, request.configSource);
    }
}

export { getDirectConfig } from './directConfig';
export { getResolvedDirectConfig } from './directConfig';
export { DirectConfigError } from './directConfig';
export type { DirectConfig } from './directConfig';
export type { ResolvedDirectConfig } from './directConfig';
