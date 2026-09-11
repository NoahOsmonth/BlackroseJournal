/**
 * Reducer for live agent activity on the streaming message: tool cards plus
 * the model's working status lines between tool batches (Pi turn shape).
 * Kept out of useChatOrchestration so that hook stays near its size budget.
 */

import type {
    AgentActivityEvent,
    AgentToolCallSnapshot,
} from '../../services/ai/agentEvents';
import type { AgentStatusLine } from './types';

export function applyAgentActivity(
    toolActivity: AgentToolCallSnapshot[] | undefined,
    event: AgentActivityEvent
): AgentToolCallSnapshot[] | undefined {
    switch (event.type) {
        case 'tool_call_start':
        case 'tool_call_end': {
            const next = [...(toolActivity ?? [])];
            const index = next.findIndex(
                (item) => item.toolCallId === event.call.toolCallId
            );
            if (index >= 0) {
                next[index] = event.call;
            } else {
                next.push(event.call);
            }
            return next;
        }
        case 'agent_end':
            // Keep finished cards until the final assistant message is committed.
            return toolActivity;
        default:
            return toolActivity;
    }
}

/**
 * Status lines for the assistant's between-tools voice. One line per turn —
 * a later line in the same turn replaces the earlier one.
 */
export function applyAgentStatusLines(
    statusLines: AgentStatusLine[] | undefined,
    event: AgentActivityEvent
): AgentStatusLine[] | undefined {
    if (event.type !== 'assistant_text_end') return statusLines;
    const text = event.text.trim();
    if (!text) return statusLines;
    const id = `t${event.round}`;
    const next = (statusLines ?? []).filter((line) => line.id !== id);
    next.push({ id, round: event.round, text });
    return next;
}

export function hasActiveToolWork(
    toolActivity: AgentToolCallSnapshot[] | undefined
): boolean {
    return Boolean(toolActivity?.some((call) => call.status === 'running'));
}
