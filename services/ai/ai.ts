import { THERAPIST_SYSTEM_PROMPT } from '@/constants/aiPrompts';
import {
    buildChatPayload,
    ChatAccumulator,
    resolveStreamOptions,
    StreamChatOptions,
    Message,
    CompleteCallback,
    ErrorCallback,
    StreamingCallback,
} from './chatTypes';
import {
    buildResponseError,
    emitSimulatedStreaming,
    readNonStreamingResponse,
    readStreamResponse,
} from './sseParser';
import {
    fetchChatCompletion,
    hasReadableStream,
    streamChatWithXhr,
} from './streamingTransports';

export {
    Message,
    StreamingCallback,
    CompleteCallback,
    ErrorCallback,
    StreamChatOptions,
} from './chatTypes';
export type { ChatAccumulator } from './chatTypes';
export { useChat } from './useChat';

const DEFAULT_DIRECT_MODEL = 'agent-default';

function normalizeUnknownError(error: unknown): Error {
    if (error instanceof Error) return error;
    if (typeof error === 'string') return new Error(error);
    try {
        return new Error(JSON.stringify(error));
    } catch {
        return new Error('Unknown error occurred');
    }
}

export async function streamChat(
    messages: Message[],
    onChunk: StreamingCallback,
    onComplete: CompleteCallback,
    onError: ErrorCallback,
    options?: string | StreamChatOptions
): Promise<void> {
    try {
        const resolved = resolveStreamOptions(options);
        const systemPrompt = resolved.systemPrompt || THERAPIST_SYSTEM_PROMPT;
        const streamPayload = buildChatPayload(
            DEFAULT_DIRECT_MODEL,
            messages,
            systemPrompt,
            true,
            resolved.conversationId,
            resolved.generation
        );

        const usedXhrStreaming = await streamChatWithXhr(
            streamPayload, onChunk, onComplete
        ).catch((error) => {
            console.warn('XMLHttpRequest streaming fallback failed:', error);
            return false;
        });
        if (usedXhrStreaming) return;

        const response = await fetchChatCompletion(streamPayload);
        const streamingAvailable = hasReadableStream(response.body)
            && (response.headers.get('content-type') || '').includes('text/event-stream');
        if (!response.ok) {
            throw await buildResponseError(response, 'AI request failed', streamingAvailable);
        }
        if (streamingAvailable && response.body) {
            await readStreamResponse(response.body, onChunk, onComplete);
            return;
        }
        const fallbackResult = await readNonStreamingResponse(response);
        await emitSimulatedStreaming(fallbackResult, onChunk);
        onComplete(fallbackResult.content, fallbackResult.reasoning);
    } catch (error) {
        onError(normalizeUnknownError(error));
    }
}

export async function completeChat(
    messages: Message[],
    systemPrompt: string,
    options?: { conversationId?: string; generation?: StreamChatOptions['generation'] }
): Promise<ChatAccumulator> {
    const payload = buildChatPayload(
        DEFAULT_DIRECT_MODEL,
        messages,
        systemPrompt,
        false,
        options?.conversationId,
        options?.generation
    );
    const response = await fetchChatCompletion(payload);
    if (!response.ok) {
        throw await buildResponseError(response, 'AI request failed', false);
    }
    return readNonStreamingResponse(response);
}
