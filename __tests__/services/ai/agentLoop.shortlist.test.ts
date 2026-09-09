/**
 * Agent-loop executor integration: REFUSED mutating calls stay re-requestable,
 * and per-turn shortlists narrow the specs sent to the provider.
 * Sibling of agentLoop.test.ts (which is over the 300-line test cap).
 */
import { runAgentTurnWithTools } from '../../../services/ai/agentLoop';
import * as aiTransport from '../../../services/ai/aiTransport';
import * as executeTool from '../../../services/ai/tools/executeTool';
import type { ToolCapability } from '../../../services/ai/tools/toolCapability';

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

const STRUCTURED_CAPABILITY: ToolCapability = {
    mode: 'structured',
    sendToolsInApi: true,
    runAgentLoop: true,
    preferTextResultProtocol: false,
    parseTextToolDumps: true,
};

describe('runAgentTurnWithTools — refused mutating re-request', () => {
    const fetchMock = aiTransport.fetchAiChatCompletion as jest.Mock;
    const toolsMock = executeTool.executeToolCalls as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('a REFUSED call re-requested alone is executed, not skipped as duplicate', async () => {
        const goalArgs = '{"title":"Run"}';
        fetchMock
            .mockResolvedValueOnce(jsonResponse({
                choices: [{
                    message: {
                        content: null,
                        tool_calls: [
                            {
                                id: 'c1',
                                type: 'function',
                                function: { name: 'update_identity', arguments: '{"preferredName":"Sam"}' },
                            },
                            {
                                id: 'c2',
                                type: 'function',
                                function: { name: 'create_goal', arguments: goalArgs },
                            },
                        ],
                    },
                }],
                usage: { prompt_tokens: 500, completion_tokens: 20, total_tokens: 520 },
            }))
            .mockResolvedValueOnce(jsonResponse(toolCallMessage('create_goal', goalArgs, null, 'c3')))
            .mockResolvedValueOnce(jsonResponse(textMessage('Goal created.')));

        toolsMock
            .mockResolvedValueOnce([
                { toolCallId: 'c1', name: 'update_identity', content: 'pinned' },
                {
                    toolCallId: 'c2',
                    name: 'create_goal',
                    content: 'REFUSED: "create_goal" was not run — re-request alone.',
                    isError: true,
                    refused: true,
                },
            ])
            .mockResolvedValueOnce([
                { toolCallId: 'c3', name: 'create_goal', content: 'Created goal g1' },
            ]);

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'call me Sam and track running', timestamp: 1 }],
            capability: STRUCTURED_CAPABILITY,
            maxRounds: 4,
        });

        // The refused call ran alone on re-request (not skipped as duplicate).
        expect(toolsMock).toHaveBeenCalledTimes(2);
        const secondBatch = toolsMock.mock.calls[1][0] as { name: string }[];
        expect(secondBatch).toHaveLength(1);
        expect(secondBatch[0].name).toBe('create_goal');
        expect(result.usedTools).toBe(true);
        expect(result.content).toBe('Goal created.');

        // Protocol completeness: both round-1 ids got tool messages, refused included.
        const round2Messages = fetchMock.mock.calls[1][0].messages as {
            role: string;
            tool_call_id?: string;
            tool_calls?: { id: string }[];
        }[];
        const assistantMsg = round2Messages.find((m) => m.role === 'assistant');
        expect(assistantMsg?.tool_calls?.map((t) => t.id).sort()).toEqual(['c1', 'c2']);
        const toolIds = round2Messages
            .filter((m) => m.role === 'tool')
            .map((m) => m.tool_call_id)
            .sort();
        expect(toolIds).toEqual(expect.arrayContaining(['c1', 'c2']));
    });

    it('sends only shortlisted specs for a history question', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(textMessage('Nothing yet.')));

        await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'what did I write about work last week?', timestamp: 1 }],
            capability: STRUCTURED_CAPABILITY,
        });

        const firstRequest = fetchMock.mock.calls[0][0] as {
            tools?: { function: { name: string } }[];
        };
        const sentNames = (firstRequest.tools ?? []).map((t) => t.function.name).sort();
        expect(sentNames).toEqual([
            'get_clock',
            'get_conversation',
            'get_day',
            'list_recent_days',
            'search_history',
        ]);
        expect(firstRequest).toHaveProperty('tool_choice', 'auto');
    });

    it('sends the full catalog when no shortlist branch matches', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(textMessage('Hi.')));

        await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'hello there friend', timestamp: 1 }],
            capability: STRUCTURED_CAPABILITY,
        });

        const firstRequest = fetchMock.mock.calls[0][0] as {
            tools?: { function: { name: string } }[];
        };
        expect((firstRequest.tools ?? []).map((t) => t.function.name)).toHaveLength(10);
    });
});
