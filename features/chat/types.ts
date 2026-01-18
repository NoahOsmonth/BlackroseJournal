/**
 * Chat feature types
 * Shared types used across the chat feature module
 */

import { Message } from '../../services/ai';

export interface StreamingMessage {
    id: string;
    role: 'assistant';
    content: string;
    reasoning: string;
    isStreaming: boolean;
}

export interface ChatState {
    messages: Message[];
    streamingMessage: StreamingMessage | null;
    isLoading: boolean;
}

export type { Message };
