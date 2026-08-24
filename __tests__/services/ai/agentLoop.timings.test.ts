/**
 * Wall-clock timing instrumentation (Task 8 of the hindsight integration plan).
 * Sibling of agentLoop.test.ts (which is already over the 300-line test cap);
 * mirrors its fixture conventions: mock fetchDirectChatCompletion at the
 * transport boundary and executeToolCalls at the tools boundary.
 */
import { runAgentTurnWithTools } from '../../../services/ai/agentLoop';
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

describe('runAgentTurnWithTools timing', () => {
    const fetchMock = aiTransport.fetchAiChatCompletion as jest.Mock;
    const toolsMock = executeTool.executeToolCalls as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('records wall-clock timings for rounds and tool batches', async () => {
        // Tool once, then a final natural answer (2 rounds, 1 tool batch).
        fetchMock
            .mockResolvedValueOnce(jsonResponse(toolCallMessage('get_clock', '{}')))
            .mockResolvedValueOnce(jsonResponse(textMessage('It is evening on your side.')));

        toolsMock.mockResolvedValueOnce([
            { toolCallId: 'call_1', name: 'get_clock', content: 'local evening' },
        ]);

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'what time is it?', timestamp: 1 }],
        });

        expect(result.timings).toBeDefined();
        expect(result.timings!.roundMs.length).toBeGreaterThanOrEqual(2);
        expect(result.timings!.toolBatchMs.length).toBeGreaterThanOrEqual(1);
        expect(result.timings!.toolsExecuted).toBe(1);
        expect(result.timings!.turnMs).toBeGreaterThanOrEqual(
            result.timings!.roundMs.reduce((a, b) => a + b, 0)
        );
    });

    it('populates timings on the final no-tools pass path', async () => {
        // Max rounds with tools every round -> final no-tools pass.
        fetchMock
            .mockResolvedValueOnce(jsonResponse(toolCallMessage('get_clock', '{}', null, 'c1')))
            .mockResolvedValueOnce(jsonResponse(toolCallMessage('get_day', '{"date":"yesterday"}', null, 'c2')))
            .mockResolvedValueOnce(jsonResponse(toolCallMessage('list_recent_days', '{"days":5}', null, 'c3')))
            .mockResolvedValueOnce(jsonResponse(textMessage('Final answer from the last pass.')));

        toolsMock
            .mockResolvedValueOnce([{ toolCallId: 'c1', name: 'get_clock', content: 'ok' }])
            .mockResolvedValueOnce([{ toolCallId: 'c2', name: 'get_day', content: 'ok' }])
            .mockResolvedValueOnce([{ toolCallId: 'c3', name: 'list_recent_days', content: 'ok' }]);

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'history?', timestamp: 1 }],
            maxRounds: 3,
        });

        expect(result.stopReason).toBe('max_rounds');
        expect(result.timings).toBeDefined();
        expect(result.timings!.roundMs.length).toBeGreaterThanOrEqual(3);
        expect(result.timings!.toolBatchMs.length).toBe(3);
        expect(result.timings!.toolsExecuted).toBe(3);
        expect(result.timings!.turnMs).toBeGreaterThanOrEqual(
            result.timings!.roundMs.reduce((a, b) => a + b, 0)
        );
    });
});
