import { loadCustomAiProviderSettings } from './customModels';
import { hasEnvDirectApiKey } from './directConfig';
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
import {
    acquireAccountOperationLease,
    runAccountBoundOperation,
} from '@/services/account/accountRuntime';

export type AiTransportMode = 'managed' | 'byok';

export type PreparedAiChatRequest =
    | { mode: 'managed'; request: PreparedManagedChatRequest }
    | { mode: 'byok'; request: PreparedDirectChatRequest };

function accountSwitchCancellationError(): Error {
    return new Error('AI request was cancelled by an account switch.');
}

/**
 * Device-direct is the default transport (matches AGENTS.md doctrine). The
 * managed backend gateway is only a fallback for builds that have no direct
 * API key configured (env or custom provider).
 */
export async function getAiTransportMode(): Promise<AiTransportMode> {
    return runAccountBoundOperation('ai-transport-mode', async ({ signal }) => {
        const settings = await loadCustomAiProviderSettings();
        if (signal.aborted) throw accountSwitchCancellationError();
        return settings.enabled || hasEnvDirectApiKey() ? 'byok' : 'managed';
    });
}

export async function fetchAiChatCompletion(
    payload: DirectChatRequest,
    options?: DirectChatOptions
): Promise<Response> {
    const lease = acquireAccountOperationLease('ai-inference-fetch');
    try {
        const mode = await getAiTransportMode();
        if (lease.signal.aborted) throw accountSwitchCancellationError();
        const response = await (mode === 'byok'
            ? fetchDirectChatCompletion(payload, options)
            : fetchManagedChatCompletion(payload, options));
        if (lease.signal.aborted) throw accountSwitchCancellationError();
        return response;
    } finally {
        lease.release();
    }
}

export async function prepareAiChatRequest(
    payload: DirectChatRequest,
    options?: DirectChatOptions
): Promise<PreparedAiChatRequest> {
    const lease = acquireAccountOperationLease('ai-inference-preparation');
    try {
        const mode = await getAiTransportMode();
        if (lease.signal.aborted) throw accountSwitchCancellationError();
        const prepared = mode === 'byok'
            ? { mode, request: await prepareDirectChatRequest(payload, options) }
            : { mode, request: await prepareManagedChatRequest(payload, options) };
        if (lease.signal.aborted) throw accountSwitchCancellationError();
        return prepared;
    } finally {
        lease.release();
    }
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
