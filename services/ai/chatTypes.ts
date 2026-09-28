import {
    DEFAULT_GENERATION,
    GenerationSettings,
    sanitizeGenerationSettings,
} from './generationSettings';
import type { AgentActivityListener, AgentToolCallSnapshot } from './agentEvents';
import type { ChatImageAttachment } from './chatImage';
import type { ToolCapability } from './tools/toolCapability';

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
    /** Tool timeline from the agent turn that produced this assistant reply. */
    toolActivity?: AgentToolCallSnapshot[];
    /**
     * Photo the writer attached to this turn (vision). Persisted as a local
     * uri only — the base64 payload is derived at request time (chatImage.ts).
     */
    image?: ChatImageAttachment;
}

/** OpenAI content part: text, or an image the provider must fetch. */
export type ChatContentPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } };

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
    /** Live agent activity listener (tool timeline). Fire-and-forget from the service. */
    onAgentActivity?: AgentActivityListener;
    /** Optional model override for this stream turn. */
    model?: string;
    /** Optional tool capability override for this stream turn. */
    capability?: ToolCapability;
    /** Optional context window override for this stream turn. */
    contextWindow?: number;
    /** Abort signal: aborting cancels the in-flight request / agent turn. */
    signal?: AbortSignal;
}

/** Raised when a chat turn is cancelled via an AbortSignal (user Stop). */
export class ChatAbortedError extends Error {
    constructor() {
        super('Chat generation was stopped by the user.');
        this.name = 'ChatAbortedError';
    }
}

export function isChatAbortedError(error: unknown): error is ChatAbortedError {
    return error instanceof ChatAbortedError
        || (error instanceof Error && error.name === 'AbortError')
        || (error instanceof Error && error.message.includes('stopped by the user'));
}

export interface ChatUsage {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
}

export interface ChatRequestPayload {
    model: string;
    messages: { role: 'system' | 'user' | 'assistant'; content: string | ChatContentPart[] }[];
    stream: boolean;
    temperature: number;
    top_p: number;
    max_tokens: number;
    conversationId?: string;
    tools?: unknown[];
    tool_choice?: 'auto' | 'none' | 'required';
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

/**
 * Map one stored message onto the wire. A turn that carries a photo is sent as
 * content parts (text + image_url); everything else stays a plain string so
 * text-only providers keep seeing exactly the payload they always have.
 */
function toWireMessage(
    message: Message,
    imageUrls?: Map<string, string>
): { role: 'user' | 'assistant'; content: string | ChatContentPart[] } {
    const dataUrl = imageUrls?.get(message.id);
    if (!dataUrl) return { role: message.role, content: message.content };
    return {
        role: message.role,
        content: [
            { type: 'text', text: message.content },
            { type: 'image_url', image_url: { url: dataUrl } },
        ],
    };
}

export function buildChatPayload(
    model: string,
    messages: Message[],
    systemPrompt: string,
    stream: boolean,
    conversationId?: string,
    generation: Partial<GenerationSettings> = DEFAULT_GENERATION,
    /** messageId → data URL for turns that attached a photo (see chatImage.ts). */
    imageUrls?: Map<string, string>
): ChatRequestPayload {
    const settings = sanitizeGenerationSettings(generation);
    return {
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map((m) => toWireMessage(m, imageUrls)),
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
