/**
 * Chat feature types
 * Shared types used across the chat feature module
 */

import type { AgentToolCallSnapshot } from '../../services/ai/agentEvents';
import { Message } from '../../services/ai';

/**
 * A working status line the model wrote on a non-final agent turn
 * ("Let me actually go dig rather than guess. One sec.").
 * Ephemeral: shown while the turn runs, dropped when the reply is committed.
 */
export interface AgentStatusLine {
    /** Stable key for the owning turn — one line per turn. */
    id: string;
    round: number;
    text: string;
}

export interface StreamingMessage {
    id: string;
    role: 'assistant';
    content: string;
    reasoning: string;
    isStreaming: boolean;
    /** Live tool cards for this turn; cleared when the turn completes. */
    toolActivity?: AgentToolCallSnapshot[];
    /** Live working status lines between tool batches; dropped on commit. */
    statusLines?: AgentStatusLine[];
}

export interface ChatState {
    messages: Message[];
    streamingMessage: StreamingMessage | null;
    isLoading: boolean;
}

export type { AgentToolCallSnapshot, Message };
