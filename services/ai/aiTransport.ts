import {
    fetchDirectChatCompletion,
    prepareDirectChatRequest,
    type DirectChatOptions,
    type DirectChatRequest,
    type PreparedDirectChatRequest,
} from './directTransport';
import { parseSseLine } from './sseParser';
import type { ParsedSseChunk } from './chatTypes';
import {
    acquireAccountOperationLease,
    runAccountBoundOperation,
} from '@/services/account/accountRuntime';

/** Device-direct is the only transport: no managed gateway fallback remains. */
export type AiTransportMode = 'byok';

export type PreparedAiChatRequest =
    | { mode: 'byok'; request: PreparedDirectChatRequest };

function accountSwitchCancellationError(): Error {
    return new Error('AI request was cancelled by an account switch.');
}

export async function fetchAiChatCompletion(
    payload: DirectChatRequest,
    options?: DirectChatOptions
): Promise<Response> {
    const lease = acquireAccountOperationLease('ai-inference-fetch');
    try {
        const response = await fetchDirectChatCompletion(payload, options);
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
        const prepared = {
            mode: 'byok' as const,
            request: await prepareDirectChatRequest(payload, options),
        };
        if (lease.signal.aborted) throw accountSwitchCancellationError();
        return prepared;
    } finally {
        lease.release();
    }
}

export function parseAiSseLine(line: string): ParsedSseChunk | null {
    return parseSseLine(line);
}

/**
 * Kept for call sites that only need to assert the active transport; there is
 * exactly one, so this never performs discovery.
 */
export function getAiTransportMode(): Promise<AiTransportMode> {
    return runAccountBoundOperation('ai-transport-mode', async () => 'byok' as const);
}
