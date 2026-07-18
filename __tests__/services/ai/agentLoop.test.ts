import { MAX_AGENT_TOOL_ROUNDS, runAgentTurnWithTools } from '../../../services/ai/agentLoop';
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

describe('runAgentTurnWithTools', () => {
    const fetchMock = directTransport.fetchDirectChatCompletion as jest.Mock;
    const toolsMock = executeTool.executeToolCalls as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns content when the model does not call tools', async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({
                choices: [{ message: { content: 'Hello there.', reasoning_content: '' } }],
            })
        );

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'hi', timestamp: 1 }],
            generation: { maxTokens: 32_768 },
        });

        expect(result.content).toBe('Hello there.');
        expect(result.usedTools).toBe(false);
        expect(result.rounds).toBe(1);
        expect(result.toolCallSource).toBe('none');
        expect(toolsMock).not.toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledWith(
            expect.objectContaining({ max_tokens: 1_536 })
        );
    });

    it('executes tool calls then returns the next content', async () => {
        fetchMock
            .mockResolvedValueOnce(
                jsonResponse({
                    choices: [{
                        message: {
                            content: null,
                            tool_calls: [{
                                id: 'call_1',
                                type: 'function',
                                function: { name: 'get_day', arguments: '{"date":"yesterday"}' },
                            }],
                        },
                    }],
                })
            )
            .mockResolvedValueOnce(
                jsonResponse({
                    choices: [{ message: { content: 'You talked about sleep.', reasoning_content: '' } }],
                })
            );

        toolsMock.mockResolvedValueOnce([
            { toolCallId: 'call_1', name: 'get_day', content: 'date: 2026-07-12\nsummary: Sleep' },
        ]);

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'What about yesterday?', timestamp: 1 }],
        });

        expect(result.usedTools).toBe(true);
        expect(result.content).toBe('You talked about sleep.');
        expect(result.toolCallSource).toBe('structured');
        expect(toolsMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        // Hybrid default prefers text result protocol for free-model robustness.
        const secondRequest = fetchMock.mock.calls[1][0] as {
            messages: { role: string; content: string | null }[];
        };
        expect(
            secondRequest.messages.some(
                (m) => m.role === 'user' && typeof m.content === 'string' && m.content.includes('Device tool results')
            )
        ).toBe(true);
    });

    it('repairs malformed structured args before execute', async () => {
        fetchMock
            .mockResolvedValueOnce(
                jsonResponse({
                    choices: [{
                        message: {
                            content: null,
                            tool_calls: [{
                                id: 'call_1',
                                type: 'function',
                                function: { name: 'get_day', arguments: '{"day":"yesterday"}' },
                            }],
                        },
                    }],
                })
            )
            .mockResolvedValueOnce(
                jsonResponse({
                    choices: [{ message: { content: 'Fixed args path worked.' } }],
                })
            );

        toolsMock.mockResolvedValueOnce([
            { toolCallId: 'call_1', name: 'get_day', content: 'ok' },
        ]);

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'yesterday?', timestamp: 1 }],
        });

        expect(result.toolsRepaired).toBeGreaterThanOrEqual(1);
        const executed = toolsMock.mock.calls[0][0] as { arguments: string }[];
        expect(JSON.parse(executed[0].arguments)).toEqual({ date: 'yesterday' });
        expect(result.content).toContain('Fixed args');
    });

    it('skips agent loop for inject_only capability', async () => {
        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'yesterday?', timestamp: 1 }],
            capability: {
                mode: 'inject_only',
                sendToolsInApi: false,
                runAgentLoop: false,
                preferTextResultProtocol: false,
                parseTextToolDumps: false,
            },
        });
        expect(result.capabilityMode).toBe('inject_only');
        expect(result.content).toBe('');
        expect(fetchMock).not.toHaveBeenCalled();
        expect(toolsMock).not.toHaveBeenCalled();
    });

    it('executes tool pseudo-code written into content (free-model text protocol)', async () => {
        fetchMock
            .mockResolvedValueOnce(
                jsonResponse({
                    choices: [{
                        message: {
                            content: 'get_day(date="yesterday")\nget_clock()',
                        },
                    }],
                })
            )
            .mockResolvedValueOnce(
                jsonResponse({
                    choices: [{
                        message: {
                            content: 'Yesterday you wrote about sleep. It is late where you are.',
                        },
                    }],
                })
            );

        toolsMock.mockResolvedValueOnce([
            { toolCallId: 'text_r0_0_get_day', name: 'get_day', content: 'summary: Sleep' },
            { toolCallId: 'text_r0_1_get_clock', name: 'get_clock', content: '22:10' },
        ]);

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'What about yesterday?', timestamp: 1 }],
        });

        expect(result.usedTools).toBe(true);
        expect(result.toolCallSource).toBe('text');
        expect(result.content).toContain('sleep');
        expect(result.content).not.toMatch(/get_day\s*\(/);
        expect(toolsMock).toHaveBeenCalledTimes(1);
        const calledNames = (toolsMock.mock.calls[0][0] as { name: string }[]).map((c) => c.name);
        expect(calledNames).toEqual(expect.arrayContaining(['get_day', 'get_clock']));

        // Text protocol feeds results as a user block (not OpenAI tool role only).
        const secondRequest = fetchMock.mock.calls[1][0] as {
            messages: { role: string; content: string | null }[];
        };
        const resultMsg = secondRequest.messages.find(
            (m) => m.role === 'user' && typeof m.content === 'string' && m.content.includes('Device tool results')
        );
        expect(resultMsg).toBeTruthy();
    });

    it('strips unexecuted tool dump from final content', async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({
                choices: [{
                    message: {
                        // Looks like a dump but uses an unknown shape we still strip
                        content: '```tool_call\nget_clock()\n```',
                    },
                }],
            })
        );
        // After parse, get_clock() is executed; if model only dumped tools, loop continues.
        // Force a path where first pass has tools executed then final natural reply:
        fetchMock.mockResolvedValueOnce(
            jsonResponse({
                choices: [{ message: { content: 'It is evening on your side.' } }],
            })
        );

        toolsMock.mockResolvedValueOnce([
            { toolCallId: 'x', name: 'get_clock', content: 'local evening' },
        ]);

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'what time is it for me?', timestamp: 1 }],
        });

        expect(result.content).not.toContain('```');
        expect(result.content).not.toMatch(/get_clock\s*\(/);
        expect(result.content.length).toBeGreaterThan(0);
    });

    it('falls back to a no-tools completion when the provider rejects tools', async () => {
        fetchMock
            .mockResolvedValueOnce(
                jsonResponse({ error: { message: 'tools not supported' } }, 400)
            )
            .mockResolvedValueOnce(
                jsonResponse({
                    choices: [{ message: { content: 'Answer from digests only.' } }],
                })
            );

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'yesterday?', timestamp: 1 }],
        });

        expect(result.content).toBe('Answer from digests only.');
        expect(fetchMock).toHaveBeenCalledTimes(2);
        // Second request must not include tools.
        const second = fetchMock.mock.calls[1][0] as { tools?: unknown };
        expect(second.tools).toBeUndefined();
    });

    it('throws when tools are rejected and the fallback completion also fails', async () => {
        fetchMock
            .mockResolvedValueOnce(
                jsonResponse({ error: { message: 'tools not supported' } }, 400)
            )
            .mockResolvedValueOnce(
                jsonResponse({ error: { message: 'upstream down' } }, 500)
            );

        await expect(
            runAgentTurnWithTools({
                systemPrompt: 'sys',
                messages: [{ id: '1', role: 'user', content: 'yesterday?', timestamp: 1 }],
            })
        ).rejects.toThrow(/Agent completion failed/);
    });

    it('caps tool rounds', () => {
        expect(MAX_AGENT_TOOL_ROUNDS).toBe(3);
    });
});
