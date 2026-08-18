import {
    AGENT_EXHAUSTION_FALLBACK,
    AGENT_TURN_TOKEN_BUDGET,
    DUPLICATE_TOOL_CALL_NOTE,
    MAX_AGENT_TOOL_ROUNDS,
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

function toolCallMessage(
    name: string,
    args: string,
    content: string | null = null,
    id = 'call_1'
) {
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

function textMessage(content: string, usage?: { prompt_tokens: number }) {
    return {
        choices: [{ message: { content, reasoning_content: '' } }],
        usage: usage ?? { prompt_tokens: 400, completion_tokens: 30, total_tokens: 430 },
    };
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

    it('exposes multi-step round + budget defaults', () => {
        expect(MAX_AGENT_TOOL_ROUNDS).toBe(6);
        expect(AGENT_TURN_TOKEN_BUDGET).toBe(24_000);
    });

    it('PR8c: cross-round token budget stops further tool rounds and runs final pass', async () => {
        // Each round reports 5_000 real prompt_tokens; budget 9_000 → stop after round 2 tools.
        fetchMock
            .mockResolvedValueOnce(
                jsonResponse({
                    ...toolCallMessage('list_recent_days', '{"days":7}', null, 'c1'),
                    usage: { prompt_tokens: 5_000, completion_tokens: 10, total_tokens: 5_010 },
                })
            )
            .mockResolvedValueOnce(
                jsonResponse({
                    ...toolCallMessage('list_recent_days', '{"days":7,"order":"oldest"}', null, 'c2'),
                    usage: { prompt_tokens: 5_000, completion_tokens: 10, total_tokens: 5_010 },
                })
            )
            .mockResolvedValueOnce(
                jsonResponse(textMessage('Final answer within budget.'))
            );

        toolsMock
            .mockResolvedValueOnce([
                { toolCallId: 'c1', name: 'list_recent_days', content: 'day A' },
            ])
            .mockResolvedValueOnce([
                { toolCallId: 'c2', name: 'list_recent_days', content: 'day B' },
            ]);

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'what is my first entry?', timestamp: 1 }],
            turnTokenBudget: 9_000,
            maxRounds: 3,
        });

        expect(result.stopReason).toBe('token_budget');
        expect(result.cumulativePromptTokens).toBeGreaterThanOrEqual(9_000);
        expect(result.content).toBe('Final answer within budget.');
        // Two tool rounds only — no third tool round.
        expect(toolsMock).toHaveBeenCalledTimes(2);
        // 2 tool completions + 1 final no-tools
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('PR8c: repeated identical list_recent_days is not re-executed; final pass runs', async () => {
        const listArgs = '{"days":7}';
        fetchMock
            .mockResolvedValueOnce(
                jsonResponse(toolCallMessage('list_recent_days', listArgs, null, 'c1'))
            )
            // Identical call again (Kimi loop shape)
            .mockResolvedValueOnce(
                jsonResponse(
                    toolCallMessage(
                        'list_recent_days',
                        listArgs,
                        'Let me continue to the next page.',
                        'c2'
                    )
                )
            )
            .mockResolvedValueOnce(
                jsonResponse(textMessage('You started with a short first-day note.'))
            );

        toolsMock.mockResolvedValueOnce([
            { toolCallId: 'c1', name: 'list_recent_days', content: 'page 1 of days' },
        ]);

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'first journal entry?', timestamp: 1 }],
            maxRounds: 3,
        });

        expect(toolsMock).toHaveBeenCalledTimes(1);
        expect(result.stopReason).toBe('duplicate_call');
        expect(result.content).toBe('You started with a short first-day note.');
        expect(result.content).not.toBe('Let me continue to the next page.');
        // Final pass request should include the duplicate note.
        const finalReq = fetchMock.mock.calls[2][0] as {
            messages: { role: string; content: string | null }[];
            tools?: unknown;
        };
        expect(finalReq.tools).toBeUndefined();
        expect(
            finalReq.messages.some(
                (m) => typeof m.content === 'string' && m.content.includes(DUPLICATE_TOOL_CALL_NOTE)
            )
        ).toBe(true);
    });

    it('PR8c: max-round exhaustion discards last-round narration; never ships hy3 leak string', async () => {
        const LEAK = 'Let me continue to the next page.';
        fetchMock
            .mockResolvedValueOnce(
                jsonResponse(toolCallMessage('get_clock', '{}', LEAK, 'c1'))
            )
            .mockResolvedValueOnce(
                jsonResponse(toolCallMessage('get_day', '{"date":"yesterday"}', LEAK, 'c2'))
            )
            .mockResolvedValueOnce(
                jsonResponse(toolCallMessage('list_recent_days', '{"days":5}', LEAK, 'c3'))
            )
            .mockResolvedValueOnce(
                jsonResponse(textMessage('Yesterday you wrote about sleep debt.'))
            );

        toolsMock
            .mockResolvedValueOnce([{ toolCallId: 'c1', name: 'get_clock', content: 'ok' }])
            .mockResolvedValueOnce([{ toolCallId: 'c2', name: 'get_day', content: 'ok' }])
            .mockResolvedValueOnce([{ toolCallId: 'c3', name: 'list_recent_days', content: 'ok' }]);

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'What about yesterday?', timestamp: 1 }],
            maxRounds: 3,
        });

        expect(result.content).not.toBe(LEAK);
        expect(result.content).not.toContain(LEAK);
        expect(result.content).toBe('Yesterday you wrote about sleep debt.');
        expect(result.stopReason).toBe('max_rounds');
        // 3 tool rounds + final no-tools
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it('PR8c: exhaustion final-pass failure ships graceful fallback (not narration)', async () => {
        const LEAK = 'Let me continue to the next page.';
        fetchMock
            .mockResolvedValueOnce(
                jsonResponse(toolCallMessage('get_clock', '{}', LEAK, 'c1'))
            )
            .mockResolvedValueOnce(
                jsonResponse(toolCallMessage('get_day', '{"date":"today"}', LEAK, 'c2'))
            )
            .mockResolvedValueOnce(
                jsonResponse(toolCallMessage('list_recent_days', '{"days":3}', LEAK, 'c3'))
            )
            .mockResolvedValueOnce(
                jsonResponse({ error: { message: 'upstream down' } }, 500)
            );

        toolsMock
            .mockResolvedValueOnce([{ toolCallId: 'c1', name: 'get_clock', content: 'ok' }])
            .mockResolvedValueOnce([{ toolCallId: 'c2', name: 'get_day', content: 'ok' }])
            .mockResolvedValueOnce([{ toolCallId: 'c3', name: 'list_recent_days', content: 'ok' }]);

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'history?', timestamp: 1 }],
            maxRounds: 3,
        });

        expect(result.content).toBe(AGENT_EXHAUSTION_FALLBACK);
        expect(result.content).not.toBe(LEAK);
    });
});
