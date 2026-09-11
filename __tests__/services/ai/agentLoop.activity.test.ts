/**
 * Agent activity listener emission (visible tool-calling harness).
 * Sibling of agentLoop.test.ts — mocks transport + executeToolCalls.
 */
import { runAgentTurnWithTools } from '../../../services/ai/agentLoop';
import type { AgentActivityEvent } from '../../../services/ai/agentEvents';
import * as aiTransport from '../../../services/ai/aiTransport';
import * as executeTool from '../../../services/ai/tools/executeTool';

jest.mock('../../../services/ai/aiTransport', () => ({
    fetchAiChatCompletion: jest.fn(),
}));

jest.mock('../../../services/ai/tools/executeTool', () => {
    const actual = jest.requireActual('../../../services/ai/tools/executeTool');
    return {
        ...actual,
        executeToolCalls: jest.fn(),
    };
});

function jsonResponse(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => JSON.stringify(body),
    } as Response;
}

function toolCallMessage(name: string, args: string, content: string | null = null, id = 'call_1') {
    return {
        choices: [{
            message: {
                content,
                tool_calls: [{
                    id,
                    type: 'function',
                    function: { name, arguments: args },
                }],
            },
        }],
        usage: { prompt_tokens: 500, completion_tokens: 20, total_tokens: 520 },
    };
}

function textMessage(content: string) {
    return {
        choices: [{ message: { content, reasoning_content: '' } }],
        usage: { prompt_tokens: 400, completion_tokens: 30, total_tokens: 430 },
    };
}

describe('runAgentTurnWithTools activity events', () => {
    const fetchMock = aiTransport.fetchAiChatCompletion as jest.Mock;
    const toolsMock = executeTool.executeToolCalls as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('emits tool start+end with matching ids on a structured tool path', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(toolCallMessage('get_day', '{"date":"yesterday"}')))
            .mockResolvedValueOnce(jsonResponse(textMessage('You talked about sleep.')));
        toolsMock.mockResolvedValueOnce([
            {
                toolCallId: 'call_1',
                name: 'get_day',
                content: 'date: 2026-07-12\nsummary: Sleep',
            },
        ]);

        const events: AgentActivityEvent[] = [];
        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'What about yesterday?', timestamp: 1 }],
            onActivity: (event) => events.push(event),
        });

        expect(result.usedTools).toBe(true);
        expect(events[0]).toMatchObject({ type: 'agent_start' });

        const starts = events.filter((e) => e.type === 'tool_call_start');
        const ends = events.filter((e) => e.type === 'tool_call_end');
        expect(starts).toHaveLength(1);
        expect(ends).toHaveLength(1);
        if (starts[0]?.type === 'tool_call_start' && ends[0]?.type === 'tool_call_end') {
            expect(starts[0].call.toolCallId).toBe('call_1');
            expect(ends[0].call.toolCallId).toBe('call_1');
            expect(starts[0].call.status).toBe('running');
            expect(ends[0].call.status).toBe('ok');
            expect(starts[0].call.label).toBe('Reading a day');
            expect(starts[0].call.argsPreview).toBe('yesterday');
            expect(typeof ends[0].call.durationMs).toBe('number');
            expect(events.some((e) => e.type === 'agent_end')).toBe(true);
        } else {
            throw new Error('expected tool_call_start/end events');
        }
    });

    it('emits only agent_start/end when the model does not call tools', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(textMessage('Hello there.')));

        const events: AgentActivityEvent[] = [];
        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'hi', timestamp: 1 }],
            onActivity: (event) => events.push(event),
        });

        expect(result.usedTools).toBe(false);
        // A turn still opens and closes when the model returns prose with no tools.
        expect(events.map((e) => e.type)).toEqual([
            'agent_start',
            'turn_start',
            'turn_end',
            'agent_end',
        ]);
        const end = events.find((e) => e.type === 'agent_end');
        if (end?.type === 'agent_end') {
            expect(end.usedTools).toBe(false);
            expect(end.rounds).toBe(1);
            expect(end.stopReason).toBe('complete');
        }
    });

    it('emits assistant_text_* before tool_call_start when a turn has both', async () => {
        fetchMock
            .mockResolvedValueOnce(
                jsonResponse(
                    toolCallMessage(
                        'get_day',
                        '{"date":"yesterday"}',
                        'Let me actually go dig rather than guess.'
                    )
                )
            )
            .mockResolvedValueOnce(jsonResponse(textMessage('You talked about sleep.')));
        toolsMock.mockResolvedValueOnce([
            { toolCallId: 'call_1', name: 'get_day', content: 'date: 2026-07-12' },
        ]);

        const events: AgentActivityEvent[] = [];
        await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'What about yesterday?', timestamp: 1 }],
            onActivity: (event) => events.push(event),
        });

        const order = events.map((e) => e.type);
        expect(order.indexOf('assistant_text_end')).toBeGreaterThan(-1);
        expect(order.indexOf('assistant_text_end')).toBeLessThan(order.indexOf('tool_call_start'));

        const textEnd = events.find((e) => e.type === 'assistant_text_end');
        if (textEnd?.type === 'assistant_text_end') {
            expect(textEnd.round).toBe(1);
            expect(textEnd.text).toBe('Let me actually go dig rather than guess.');
        }
    });

    it('still emits agent_end on the timeout path', async () => {
        fetchMock
            .mockImplementationOnce(
                () =>
                    new Promise<Response>((resolve) =>
                        setTimeout(() => resolve(jsonResponse(toolCallMessage('get_clock', '{}'))), 120)
                    )
            )
            .mockResolvedValueOnce(jsonResponse(textMessage('Final answer after timeout.')));
        toolsMock.mockResolvedValueOnce([
            { toolCallId: 'call_1', name: 'get_clock', content: 'ok' },
        ]);

        const events: AgentActivityEvent[] = [];
        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'what time is it?', timestamp: 1 }],
            turnTimeoutMs: 50,
            onActivity: (event) => events.push(event),
        });

        expect(result.stopReason).toBe('timeout');
        const end = events.find((e) => e.type === 'agent_end');
        expect(end).toBeTruthy();
        if (end?.type === 'agent_end') {
            expect(end.stopReason).toBe('timeout');
        }
    });

    it('does not throw when the activity listener throws', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(textMessage('Still fine.')));

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'hi', timestamp: 1 }],
            onActivity: () => {
                throw new Error('listener boom');
            },
        });

        expect(result.content).toBe('Still fine.');
    });

    it('marks refused results as refused on tool_call_end', async () => {
        fetchMock
            .mockResolvedValueOnce(
                jsonResponse({
                    choices: [{
                        message: {
                            content: null,
                            tool_calls: [
                                {
                                    id: 'call_1',
                                    type: 'function',
                                    function: { name: 'update_identity', arguments: '{"preferredName":"Sam"}' },
                                },
                                {
                                    id: 'call_2',
                                    type: 'function',
                                    function: { name: 'create_goal', arguments: '{"title":"Run"}' },
                                },
                            ],
                        },
                    }],
                })
            )
            .mockResolvedValueOnce(jsonResponse(textMessage('Saved.')));
        toolsMock.mockResolvedValueOnce([
            {
                toolCallId: 'call_1',
                name: 'update_identity',
                content: 'updated',
            },
            {
                toolCallId: 'call_2',
                name: 'create_goal',
                content: 'REFUSED: mutating conflict',
                isError: true,
                refused: true,
            },
        ]);

        const events: AgentActivityEvent[] = [];
        await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'call me Sam and create a goal', timestamp: 1 }],
            onActivity: (event) => events.push(event),
        });

        const ends = events.filter((e) => e.type === 'tool_call_end');
        expect(ends).toHaveLength(2);
        const statuses = ends.map((e) => (e.type === 'tool_call_end' ? e.call.status : null));
        expect(statuses).toContain('ok');
        expect(statuses).toContain('refused');
    });
});
