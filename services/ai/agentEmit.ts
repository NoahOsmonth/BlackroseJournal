/**
 * Activity emission helpers for the agent loop (Pi-shaped timeline).
 * Extracted from agentLoop.ts to keep the loop file inside its size budget.
 * Soft-fail by contract: a throwing listener must never break a turn.
 */

import {
    logToolTelemetry,
} from './tools/toolCapability';
import {
    formatToolArgsPreview,
    formatToolResultPreview,
    getToolUiMeta,
} from './tools/toolUiMeta';
import type { ToolResult } from './tools/types';
import { looksLikeToolDump } from './tools/parseTextToolCalls';
import type {
    AgentActivityEvent,
    AgentActivityListener,
    AgentToolCallSnapshot,
    AgentToolStatus,
} from './agentEvents';

function buildToolSnapshot(options: {
    toolCallId: string;
    name: string;
    arguments: string;
    round: number;
    status: AgentToolStatus;
    durationMs?: number;
    result?: ToolResult;
    origin?: 'structured' | 'text';
}): AgentToolCallSnapshot {
    const meta = getToolUiMeta(options.name);
    return {
        toolCallId: options.toolCallId,
        name: options.name,
        label: meta.label,
        argsPreview: formatToolArgsPreview(options.name, options.arguments),
        status: options.status,
        round: options.round,
        ...(options.durationMs !== undefined ? { durationMs: options.durationMs } : {}),
        ...(options.result
            ? { resultPreview: formatToolResultPreview(options.name, options.result) }
            : {}),
        ...(options.origin ? { origin: options.origin } : {}),
    };
}

function toolStatusFromResult(result: ToolResult): AgentToolStatus {
    if (result.refused) return 'refused';
    if (result.isError) return 'error';
    return 'ok';
}

export function emitToolCallStarts(
    toolCalls: readonly { id: string; name: string; arguments: string; origin: 'structured' | 'text' }[],
    round: number,
    emitActivity: (event: AgentActivityEvent) => void
): Map<string, number> {
    const startedAtByCallId = new Map<string, number>();
    const now = Date.now();
    toolCalls.forEach((call) => {
        startedAtByCallId.set(call.id, now);
        emitActivity({
            type: 'tool_call_start',
            call: buildToolSnapshot({
                toolCallId: call.id,
                name: call.name,
                arguments: call.arguments,
                round,
                status: 'running',
                origin: call.origin,
            }),
        });
    });
    return startedAtByCallId;
}

export function emitToolCallEnds(
    toolCalls: readonly { id: string; name: string; arguments: string; origin: 'structured' | 'text' }[],
    results: readonly ToolResult[],
    startedAtByCallId: Map<string, number>,
    round: number,
    emitActivity: (event: AgentActivityEvent) => void
): void {
    const now = Date.now();
    results.forEach((result) => {
        const source = toolCalls.find((call) => call.id === result.toolCallId);
        const startedAt = startedAtByCallId.get(result.toolCallId) ?? now;
        emitActivity({
            type: 'tool_call_end',
            call: buildToolSnapshot({
                toolCallId: result.toolCallId,
                name: result.name || source?.name || 'unknown',
                arguments: source?.arguments ?? '{}',
                round,
                status: toolStatusFromResult(result),
                durationMs: Math.max(0, now - startedAt),
                result,
                ...(source ? { origin: source.origin } : {}),
            }),
        });
    });
}

/**
 * Publish the assistant's own words for a turn that is NOT the final answer
 * (a working status line accompanying tools, or a turn the loop will continue).
 * Emits start → one delta → end so the UI can render it like Pi does.
 */
export function emitAssistantText(
    round: number,
    text: string | null | undefined,
    emitActivity: (event: AgentActivityEvent) => void
): void {
    const trimmed = (text ?? '').trim();
    if (!trimmed) return;
    // Tool syntax is not the assistant's voice — the dump path handles it.
    if (looksLikeToolDump(trimmed)) return;
    emitActivity({ type: 'assistant_text_start', round });
    emitActivity({ type: 'assistant_text_delta', round, delta: trimmed });
    emitActivity({ type: 'assistant_text_end', round, text: trimmed });
}

/**
 * Close out parsed calls that must NOT be executed (e.g. arguments truncated by
 * the provider's token limit). The model sees a re-issue note; the UI sees an
 * error row rather than a call that silently vanished.
 */
export function emitToolCallErrors(
    toolCalls: readonly {
        id: string;
        name: string;
        arguments: string;
        origin: 'structured' | 'text';
    }[],
    round: number,
    message: string,
    emitActivity: (event: AgentActivityEvent) => void
): void {
    toolCalls.forEach((call) => {
        const meta = getToolUiMeta(call.name);
        emitActivity({
            type: 'tool_call_end',
            call: {
                toolCallId: call.id,
                name: call.name,
                label: meta.label,
                argsPreview: formatToolArgsPreview(call.name, call.arguments),
                status: 'error',
                round,
                resultPreview: message,
                origin: call.origin,
            },
        });
    });
}

export function activityEmitter(
    onActivity: AgentActivityListener | undefined,
    runId: string
): (event: AgentActivityEvent) => void {
    return (event: AgentActivityEvent) => {
        if (!onActivity) return;
        try {
            onActivity(event);
        } catch (error) {
            logToolTelemetry('agent_activity_listener_error', {
                runId,
                eventType: event.type,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    };
}
