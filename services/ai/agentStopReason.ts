/**
 * Provider finish_reason → loop decision mapping.
 *
 * Pi is explicit here: a truncated tool call (finish_reason "length") is NOT
 * executable, and "tool_use"/"tool_calls" with zero parsed calls is NOT a
 * final answer. Collapsing every stop into one finalize branch is how agents
 * ship half-executed tool calls and hollow replies.
 *
 * Pure + exported: unit-test heavy.
 */

/** Raw provider finish_reason values we care about, normalized. */
export type AgentProviderStopReason =
    | 'stop'
    | 'tool_use'
    | 'length'
    | 'content_filter'
    | 'error'
    | 'unknown';

/** What the loop should do next. */
export type AgentStopMapping =
    | 'finalize'                // no tools, no promise → real answer
    | 'execute_tools'           // parsed tool calls, complete arguments
    | 'truncated_tools'         // tool calls cut off by the token limit — never run
    | 'tooluse_no_calls'        // provider claims tool use but nothing parsed — nudge
    | 'continue'                // promise / dump — keep looping
    | 'abort';                  // content filter etc. — stop cleanly

const STOP_ALIASES: Record<string, AgentProviderStopReason> = {
    stop: 'stop',
    end_turn: 'stop',
    endturn: 'stop',
    stop_sequence: 'stop',
    tool_use: 'tool_use',
    tooluse: 'tool_use',
    tool_calls: 'tool_use',
    toolcalls: 'tool_use',
    function_call: 'tool_use',
    function_calls: 'tool_use',
    length: 'length',
    max_tokens: 'length',
    maxtokens: 'length',
    max_output_tokens: 'length',
    content_filter: 'content_filter',
    contentfilter: 'content_filter',
    safety: 'content_filter',
    error: 'error',
};

/** Normalize a provider's finish_reason string (any casing / alias family). */
export function normalizeStopReason(raw: unknown): AgentProviderStopReason {
    if (typeof raw !== 'string') return 'unknown';
    return STOP_ALIASES[raw.trim().toLowerCase()] ?? 'unknown';
}

/** True only for a clean, non-truncated stop. */
export function isStop(reason: AgentProviderStopReason): boolean {
    return reason === 'stop';
}

/**
 * The single decision table for "what does this turn's stop reason mean".
 * `hasToolCalls` is the count AFTER structured + text parse + repair.
 */
export function resolveStopMapping(
    reason: AgentProviderStopReason,
    parsedToolCallCount: number
): AgentStopMapping {
    if (reason === 'tool_use') {
        return parsedToolCallCount > 0 ? 'execute_tools' : 'tooluse_no_calls';
    }
    if (reason === 'length') {
        // Truncated tool calls are unusable — the arguments are cut mid-JSON.
        return parsedToolCallCount > 0 ? 'truncated_tools' : 'finalize';
    }
    if (reason === 'content_filter' || reason === 'error') return 'abort';
    return 'finalize';
}

/**
 * Best-effort read of a completion's finish reason across provider shapes
 * (OpenAI `finish_reason`, Anthropic `stop_reason`, loose `stop`).
 */
export function resolveFinishReason(data: unknown): AgentProviderStopReason {
    if (typeof data !== 'object' || data === null) return 'unknown';
    const record = data as Record<string, unknown>;
    const choices = record.choices;
    if (Array.isArray(choices) && choices.length > 0) {
        const first = choices[0];
        if (typeof first === 'object' && first !== null) {
            const choice = first as Record<string, unknown>;
            const direct = normalizeStopReason(choice.finish_reason ?? choice.stop_reason);
            if (direct !== 'unknown') return direct;
        }
    }
    return normalizeStopReason(record.stop_reason ?? record.finish_reason);
}

/** Tool-call arguments the provider cut off at the token limit. */
export const TRUNCATED_TOOL_NOTE =
    'System note: your tool call was cut off by the token limit, so it was not run. '
    + 'Re-issue the call with the arguments complete and short.';

/** Provider claimed tool use but no call survived parsing/repair. */
export const TOOLUSE_NO_CALLS_NOTE =
    'System note: you indicated a tool call but none arrived. Either call the tool now with '
    + 'complete arguments (structured tool_calls) or answer the user with what you already have.';
