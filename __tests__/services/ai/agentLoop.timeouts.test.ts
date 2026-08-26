/**
 * Whole-turn timeout (Task 9 of the hindsight integration plan).
 * Sibling of agentLoop.test.ts (which is already over the 300-line test cap);
 * mirrors its fixture conventions: mock fetchDirectChatCompletion at the
 * transport boundary and executeToolCalls at the tools boundary.
 */
import {
    AGENT_TURN_TIMEOUT_MS,
    runAgentTurnWithTools,
} from '../../../services/ai/agentLoop';
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

describe('runAgentTurnWithTools whole-turn timeout', () => {
    const fetchMock = aiTransport.fetchAiChatCompletion as jest.Mock;
    const toolsMock = executeTool.executeToolCalls as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('aborts the loop at the turn deadline and runs a final no-tools pass', async () => {
        // Round 1 completion is slow (> the injected 50ms deadline); the final
        // no-tools pass resolves immediately.
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

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'what time is it?', timestamp: 1 }],
            turnTimeoutMs: 50,
        });

        expect(result.stopReason).toBe('timeout');
        expect(result.content).toBe('Final answer after timeout.');
        expect(result.content.length).toBeGreaterThan(0);
        // One slow tool round only — the deadline cut off further rounds.
        expect(toolsMock).toHaveBeenCalledTimes(1);
    });

    it('exposes a sane default turn timeout constant', () => {
        expect(AGENT_TURN_TIMEOUT_MS).toBe(45_000);
    });
});
