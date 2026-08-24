import { loadCustomAiProviderSettings } from './customModels';
import {
    fetchDirectChatCompletion,
    prepareDirectChatRequest,
    type DirectChatOptions,
    type DirectChatRequest,
    type PreparedDirectChatRequest,
} from './directTransport';
import {
    fetchManagedChatCompletion,
    managedEventToOpenAiSse,
    prepareManagedChatRequest,
    type PreparedManagedChatRequest,
} from './managedTransport';
import { parseNormalizedInferenceEvent } from '@blackrose/ai-control-plane-contracts';
import { parseSseLine } from './sseParser';
import type { ParsedSseChunk } from './chatTypes';

export type AiTransportMode = 'managed' | 'byok';

export type PreparedAiChatRequest =
    | { mode: 'managed'; request: PreparedManagedChatRequest }
    | { mode: 'byok'; request: PreparedDirectChatRequest };

export async function getAiTransportMode(): Promise<AiTransportMode> {
    const settings = await loadCustomAiProviderSettings();
    return settings.enabled ? 'byok' : 'managed';
}

export async function fetchAiChatCompletion(
    payload: DirectChatRequest,
    options?: DirectChatOptions
): Promise<Response> {
    const mode = await getAiTransportMode();
    return mode === 'byok'
        ? fetchDirectChatCompletion(payload, options)
        : fetchManagedChatCompletion(payload, options);
}

export async function prepareAiChatRequest(
    payload: DirectChatRequest,
    options?: DirectChatOptions
): Promise<PreparedAiChatRequest> {
    const mode = await getAiTransportMode();
    if (mode === 'byok') {
        return { mode, request: await prepareDirectChatRequest(payload, options) };
    }
    return { mode, request: await prepareManagedChatRequest(payload, options) };
}

export function parseAiSseLine(line: string, mode: AiTransportMode): ParsedSseChunk | null {
    if (mode === 'byok') return parseSseLine(line);
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return null;
    const payload = trimmed.slice(5).trim();
    if (payload === '[DONE]') return { done: true };
    if (!payload) return null;
    try {
        const event = parseNormalizedInferenceEvent(JSON.parse(payload));
        return parseSseLine(managedEventToOpenAiSse(event));
    } catch {
        return null;
    }
}
