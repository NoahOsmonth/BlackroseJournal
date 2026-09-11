import {
    applyAgentActivity,
    applyAgentStatusLines,
    hasActiveToolWork,
} from '../../features/chat/agentActivity';
import type {
    AgentActivityEvent,
    AgentToolCallSnapshot,
} from '../../services/ai/agentEvents';

function call(overrides: Partial<AgentToolCallSnapshot> = {}): AgentToolCallSnapshot {
    return {
        toolCallId: 'call_1',
        name: 'get_day',
        label: 'Reading a day',
        argsPreview: 'yesterday',
        status: 'running',
        round: 1,
        ...overrides,
    };
}

describe('applyAgentActivity', () => {
    it('upserts on tool_call_start and replaces on tool_call_end', () => {
        const start: AgentActivityEvent = { type: 'tool_call_start', call: call() };
        const afterStart = applyAgentActivity(undefined, start);
        expect(afterStart).toHaveLength(1);
        expect(afterStart?.[0]?.status).toBe('running');

        const end: AgentActivityEvent = {
            type: 'tool_call_end',
            call: call({ status: 'ok', durationMs: 10 }),
        };
        const afterEnd = applyAgentActivity(afterStart, end);
        expect(afterEnd).toHaveLength(1);
        expect(afterEnd?.[0]?.status).toBe('ok');
        expect(afterEnd?.[0]?.durationMs).toBe(10);
    });

    it('keeps cards on agent_end', () => {
        const list = [call({ status: 'ok' })];
        const next = applyAgentActivity(list, {
            type: 'agent_end',
            usedTools: true,
            rounds: 1,
            stopReason: 'complete',
        });
        expect(next).toBe(list);
    });

    it('detects running work', () => {
        expect(hasActiveToolWork([call()])).toBe(true);
        expect(hasActiveToolWork([call({ status: 'ok' })])).toBe(false);
        expect(hasActiveToolWork(undefined)).toBe(false);
    });
});

describe('applyAgentStatusLines', () => {
    const textEnd = (round: number, text: string): AgentActivityEvent => ({
        type: 'assistant_text_end',
        round,
        text,
    });

    it('adds a line per turn from assistant_text_end', () => {
        const next = applyAgentStatusLines(undefined, textEnd(1, 'Let me go dig. One sec.'));
        expect(next).toEqual([{ id: 't1', round: 1, text: 'Let me go dig. One sec.' }]);
    });

    it('replaces the line for the same turn instead of stacking', () => {
        const first = applyAgentStatusLines(undefined, textEnd(2, 'Checking.'));
        const next = applyAgentStatusLines(first, textEnd(2, 'Still checking.'));
        expect(next).toHaveLength(1);
        expect(next?.[0]?.text).toBe('Still checking.');
    });

    it('keeps lines from different turns in order', () => {
        const first = applyAgentStatusLines(undefined, textEnd(1, 'Digging.'));
        const next = applyAgentStatusLines(first, textEnd(3, 'Looking at that day.'));
        expect(next?.map((l) => l.round)).toEqual([1, 3]);
    });

    it('ignores empty text and non-text events', () => {
        expect(applyAgentStatusLines(undefined, textEnd(1, '   '))).toBeUndefined();
        const list = applyAgentStatusLines(undefined, textEnd(1, 'Digging.'));
        const unchanged = applyAgentStatusLines(list, {
            type: 'tool_call_start',
            call: call(),
        });
        expect(unchanged).toBe(list);
        const afterEnd = applyAgentStatusLines(list, {
            type: 'agent_end',
            usedTools: true,
            rounds: 1,
            stopReason: 'complete',
        });
        expect(afterEnd).toBe(list);
    });
});
