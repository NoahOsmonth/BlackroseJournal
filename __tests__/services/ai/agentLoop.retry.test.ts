/**
 * One-shot thin-result retry nudge in the agent loop.
 * Sibling of agentLoop.test.ts (which is already over the 300-line test cap);
 * mirrors its fixture conventions: mock fetchDirectChatCompletion at the
 * transport boundary and executeToolCalls at the tools boundary.
 */
import {
    THIN_RESULT_RETRY_NOTE,
    runAgentTurnWithTools,
} from '../../../services/ai/agentLoop';
import * as directTransport from '../../../services/ai/directTransport';
import * as executeTool from '../../../services/ai/tools/executeTool';

jest.mock('../../../services/ai/directTransport', () => ({
    fetchDirectChatCompletion: jest.fn(),
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

function requestMessages(callIndex: number): { role: string; content: string | null }[] {
    const call = (directTransport.fetchDirectChatCompletion as jest.Mock).mock.calls[callIndex];
    return (call?.[0]?.messages ?? []) as { role: string; content: string | null }[];
}

function countNudges(callIndex: number): number {
    return requestMessages(callIndex).filter(
        (m) => typeof m.content === 'string' && m.content.includes(THIN_RESULT_RETRY_NOTE)
    ).length;
}

describe('runAgentTurnWithTools thin-result retry nudge', () => {
    const fetchMock = directTransport.fetchDirectChatCompletion as jest.Mock;
    const toolsMock = executeTool.executeToolCalls as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('nudges once on empty results, then accepts a retry with different args', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(toolCallMessage('search_history', '{"query":"x"}')))
            .mockResolvedValueOnce(jsonResponse(toolCallMessage('search_history', '{"query":"y"}')))
            .mockResolvedValueOnce(jsonResponse(textMessage('Found it.')));

        toolsMock
            .mockResolvedValueOnce([
                { toolCallId: 'call_1', name: 'search_history', content: 'No history matches for "x".' },
            ])
            .mockResolvedValueOnce([
                { toolCallId: 'call_1', name: 'search_history', content: 'found: day 1' },
            ]);

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'find it', timestamp: 1 }],
            maxRounds: 6,
        });

        expect(result.content).toBe('Found it.');
        expect(result.usedTools).toBe(true);
        // Retry round and answer round requests both carry the single nudge.
        expect(countNudges(1)).toBe(1);
        expect(countNudges(2)).toBe(1);
        // The retry actually used different args.
        const retryArgs = (toolsMock.mock.calls[1][0] as { arguments: string }[])[0].arguments;
        expect(JSON.parse(retryArgs)).toEqual({ query: 'y' });
    });

    it('control: no nudge when a tool batch returns real content', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(toolCallMessage('get_day', '{"date":"yesterday"}')))
            .mockResolvedValueOnce(jsonResponse(textMessage('You wrote about sleep.')));

        toolsMock.mockResolvedValueOnce([
            { toolCallId: 'call_1', name: 'get_day', content: 'date: 2026-07-12\nsummary: Sleep' },
        ]);

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'yesterday?', timestamp: 1 }],
        });

        expect(result.content).toBe('You wrote about sleep.');
        for (const [index] of fetchMock.mock.calls.entries()) {
            expect(countNudges(index)).toBe(0);
        }
    });

    it('nudges at most once per turn even when a later batch is also empty', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(toolCallMessage('search_history', '{"query":"a"}')))
            .mockResolvedValueOnce(jsonResponse(toolCallMessage('search_history', '{"query":"b"}')))
            .mockResolvedValueOnce(jsonResponse(toolCallMessage('search_history', '{"query":"c"}')))
            .mockResolvedValueOnce(jsonResponse(textMessage('Best effort answer.')));

        toolsMock
            .mockResolvedValueOnce([
                { toolCallId: 'call_1', name: 'search_history', content: 'No history matches for "a".' },
            ])
            .mockResolvedValueOnce([
                { toolCallId: 'call_1', name: 'search_history', content: 'found: day 1' },
            ])
            .mockResolvedValueOnce([
                { toolCallId: 'call_1', name: 'search_history', content: 'No history matches for "c".' },
            ]);

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'find it', timestamp: 1 }],
            maxRounds: 6,
        });

        expect(result.content).toBe('Best effort answer.');
        // agentMessages only grows, so the final request's nudge count equals the
        // total number of nudges pushed across the whole turn.
        expect(countNudges(3)).toBe(1);
    });

    it('nudges in the structured branch too (per-result tool role messages)', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(toolCallMessage('search_history', '{"query":"x"}')))
            .mockResolvedValueOnce(jsonResponse(textMessage('Structured retry worked.')));

        toolsMock.mockResolvedValueOnce([
            { toolCallId: 'call_1', name: 'search_history', content: '[tool:search_history] timed out' },
        ]);

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'find it', timestamp: 1 }],
            maxRounds: 6,
            capability: {
                mode: 'structured',
                sendToolsInApi: true,
                runAgentLoop: true,
                preferTextResultProtocol: false,
                parseTextToolDumps: true,
            },
        });

        expect(result.usedTools).toBe(true);
        expect(result.content).toBe('Structured retry worked.');
        const messages = requestMessages(1);
        expect(
            messages.some((m) => m.role === 'tool' && m.content === '[tool:search_history] timed out')
        ).toBe(true);
        expect(countNudges(1)).toBe(1);
    });
});
