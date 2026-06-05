export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    reasoning?: string;
    timestamp: number;
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
}

export interface ChatRequestPayload {
    model: string;
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
    stream: boolean;
    temperature: number;
    max_tokens: number;
    conversationId?: string;
}

export interface ChatAccumulator {
    content: string;
    reasoning: string;
}

export interface ParsedSseChunk {
    content?: string;
    reasoning?: string;
    done?: boolean;
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
    conversationId?: string
): ChatRequestPayload {
    return {
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        stream,
        temperature: 1.0,
        max_tokens: 32768,
        conversationId,
    };
}

export function resolveStreamOptions(options?: string | StreamChatOptions): StreamChatOptions {
    if (!options) return {};
    if (typeof options === 'string') return { systemPrompt: options };
    return options;
}
