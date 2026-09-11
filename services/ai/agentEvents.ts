/**
 * Agent activity event types for the live tool-calling timeline.
 * Pi-shaped: a **turn** is one LLM call plus zero-or-more tool executions.
 * Pure types — no UI, no storage, no tool semantics.
 */

export type AgentToolStatus = 'running' | 'ok' | 'error' | 'refused';

/** Where a tool call came from: the provider's tool_calls or a text pseudo-code dump. */
export type AgentToolCallOrigin = 'structured' | 'text';

export interface AgentToolCallSnapshot {
    toolCallId: string;
    name: string;
    /** Short human label from TOOL_UI_META (not the raw tool name). */
    label: string;
    /** Compact args preview for the card (e.g. "yesterday", "work stress"). */
    argsPreview: string;
    status: AgentToolStatus;
    /** ms wall-clock once finished. */
    durationMs?: number;
    /** 1-line result teaser; never the full transcript. */
    resultPreview?: string;
    /** 1-based turn index (one LLM call + its tool batch). */
    round: number;
    /** Set when the loop knows which parser produced the call. */
    origin?: AgentToolCallOrigin;
}

/** Why the agent loop stopped (or how it was cut short). */
export type AgentStopReason =
    | 'complete'                // last turn: no tools, a real answer
    | 'promised_more_timeout'   // kept saying "one sec" until the promise cap
    | 'max_rounds'
    | 'token_budget'
    | 'timeout'
    | 'duplicate_call'
    | 'skipped'                 // the turn produced nothing usable — forced final pass
    | 'error';

/** Why the loop pushed an extra nudge instead of ending the turn. */
export type AgentFollowUpReason =
    | 'thin_result'         // every tool result came back empty/thin — retry once
    | 'promised_more'       // the model ended on a status line instead of an answer
    | 'duplicate'           // it re-issued a call that already ran
    | 'truncated_tools'     // its tool arguments were cut off by the token limit
    | 'tooluse_no_calls';   // it claimed a tool call but nothing arrived

export type AgentActivityEvent =
    // lifecycle
    | { type: 'agent_start'; runId: string }
    | { type: 'agent_end'; usedTools: boolean; rounds: number; stopReason?: AgentStopReason }

    // turn = one LLM call + zero-or-more tool executions
    | { type: 'turn_start'; round: number }
    | { type: 'turn_end'; round: number; hasToolCalls: boolean }

    // the assistant's voice for THIS turn — may accompany tool calls (working status)
    | { type: 'assistant_text_start'; round: number }
    | { type: 'assistant_text_delta'; round: number; delta: string }
    | { type: 'assistant_text_end'; round: number; text: string }

    // tools
    | { type: 'tool_call_start'; call: AgentToolCallSnapshot }
    | { type: 'tool_call_end'; call: AgentToolCallSnapshot }

    // the loop decided to run another turn rather than finish
    | { type: 'follow_up_injected'; reason: AgentFollowUpReason };

export type AgentActivityListener = (event: AgentActivityEvent) => void;
