import {
    DEFAULT_GENERATION,
    GenerationSettings,
    sanitizeGenerationSettings,
} from './generationSettings';

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    reasoning?: string;
    timestamp: number;
    /** Captured only for messages authored after Phase 1 temporal support. */
    authoredTimezone?: string | null;
    localDate?: string | null;
    temporalProvenance?: 'captured' | 'legacy_unknown';
    /** Source-owner revision populated when the message is persisted for MIRROR. */
    revision?: number;
}

export interface StreamingCallback {
    (chunk: string, reasoning?: string): void;
}

export interface CompleteCallback {
    (fullContent: string, fullReasoning: string): void;
}

export interface ErrorCallback {
    (error: Error): void;
}

export interface StreamChatOptions {
    systemPrompt?: string;
    conversationId?: string;
    generation?: Partial<GenerationSettings>;
    /**
     * When true, history tools may run for this turn (agent loop).
     * Defaults to auto: enabled when the latest user message looks temporal/historical.
     */
    enableHistoryTools?: boolean | 'auto';
}

export interface ChatUsage {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
}

export interface ChatRequestPayload {
    model: string;
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
    stream: boolean;
    temperature: number;
    top_p: number;
    max_tokens: number;
    conversationId?: string;
    tools?: unknown[];
    tool_choice?: 'auto' | 'none';
    /** OpenAI: include usage on the final stream chunk. */
    stream_options?: { include_usage?: boolean };
}

export interface ChatAccumulator {
    content: string;
    reasoning: string;
    usage?: ChatUsage | null;
}

export interface ParsedSseChunk {
    content?: string;
    reasoning?: string;
    done?: boolean;
    usage?: ChatUsage | null;
    error?: Error;
    finishReason?: string;
}

export interface SimulatedStreamingOptions {
    chunkSize?: number;
    chunkDelayMs?: number;
}

export function generateConversationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `chat_${timestamp}_${random}`;
}

export function buildChatPayload(
    model: string,
    messages: Message[],
    systemPrompt: string,
    stream: boolean,
    conversationId?: string,
    generation: Partial<GenerationSettings> = DEFAULT_GENERATION
): ChatRequestPayload {
    const settings = sanitizeGenerationSettings(generation);
    return {
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        stream,
        temperature: settings.temperature,
        top_p: settings.topP,
        max_tokens: settings.maxTokens,
        conversationId,
        // PR8c: request final-chunk usage so stream path can log real prompt_tokens.
        ...(stream ? { stream_options: { include_usage: true } } : {}),
    };
}

export function resolveStreamOptions(options?: string | StreamChatOptions): StreamChatOptions {
    if (!options) return {};
    if (typeof options === 'string') return { systemPrompt: options };
    return options;
}
