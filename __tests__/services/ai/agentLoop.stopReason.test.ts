/**
 * Provider stop-reason handling in the loop: truncated tool calls must never
 * run, and a tool-use claim with nothing parsed must never finalize.
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

/** Tool call whose arguments were cut off by the token limit. */
function truncatedToolMessage(id = 'call_1') {
    return {
        choices: [{
            finish_reason: 'length',
            message: {
                content: null,
                tool_calls: [{
                    id,
                    type: 'function',
                    // Mid-JSON: the closing brace never arrived.
                    function: { name: 'get_conversation', arguments: '{"kind":"journal_entry","id":"entry_abc' },
                }],
            },
        }],
        usage: { prompt_tokens: 500, completion_tokens: 1536, total_tokens: 2036 },
    };
}

function toolUseMessage(name: string, args: string, id = 'call_1') {
    return {
        choices: [{
            finish_reason: 'tool_calls',
            message: {
                content: null,
                tool_calls: [{ id, type: 'function', function: { name, arguments: args } }],
            },
        }],
        usage: { prompt_tokens: 500, completion_tokens: 20, total_tokens: 520 },
    };
}

/** Provider says it wants a tool but the payload carries none. */
function toolUseNoCallsMessage() {
    return {
        choices: [{ finish_reason: 'tool_calls', message: { content: null, tool_calls: [] } }],
        usage: { prompt_tokens: 500, completion_tokens: 10, total_tokens: 510 },
    };
}

function textMessage(content: string, finishReason = 'stop') {
    return {
        choices: [{ finish_reason: finishReason, message: { content, reasoning_content: '' } }],
        usage: { prompt_tokens: 400, completion_tokens: 30, total_tokens: 430 },
    };
}

describe('runAgentTurnWithTools provider stop reasons', () => {
    const fetchMock = aiTransport.fetchAiChatCompletion as jest.Mock;
    const toolsMock = executeTool.executeToolCalls as jest.Mock;

    beforeEach(() => {
        // mockReset (not clearAllMocks): a test that consumes fewer queued
        // responses than it set must not leak them into the next test.
        fetchMock.mockReset();
        toolsMock.mockReset();
        toolsMock.mockResolvedValue([
            { toolCallId: 'call_1', name: 'get_day', content: 'summary: Sleep was rough' },
        ]);
    });

    it('does not execute truncated tool calls and records the provider stop reason', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(truncatedToolMessage()))
            // Re-issue after the truncation nudge, complete this time.
            .mockResolvedValueOnce(jsonResponse(toolUseMessage('get_day', '{"date":"yesterday"}')))
            .mockResolvedValueOnce(jsonResponse(textMessage('You wrote about broken sleep.')));

        const events: AgentActivityEvent[] = [];
        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'what about yesterday?', timestamp: 1 }],
            onActivity: (event) => events.push(event),
        });

        // First turn: the truncated call was reported as an error, never executed.
        const errorEnds = events.filter(
            (e) => e.type === 'tool_call_end' && e.call.status === 'error'
        );
        expect(errorEnds).toHaveLength(1);
        if (errorEnds[0]?.type === 'tool_call_end') {
            expect(errorEnds[0].call.resultPreview).toContain('truncated');
        }

        const reIssue = fetchMock.mock.calls[1][0] as {
            messages: { role: string; content: string | null }[];
        };
        expect(
            reIssue.messages.some(
                (m) => typeof m.content === 'string' && m.content.includes('cut off by the token limit')
            )
        ).toBe(true);

        expect(result.content).toBe('You wrote about broken sleep.');
        expect(result.providerStopReason).toBe('stop');
        // Only the valid re-issued call ran.
        expect(toolsMock).toHaveBeenCalledTimes(1);
        const executed = toolsMock.mock.calls[0][0] as { name: string }[];
        expect(executed.map((c) => c.name)).toEqual(['get_day']);
    });

    it('does not finalize when the provider claims tool use but no call parsed', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(toolUseNoCallsMessage()))
            .mockResolvedValueOnce(jsonResponse(textMessage('Here is the answer.')));

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'history?', timestamp: 1 }],
        });

        expect(result.rounds).toBe(2);
        expect(result.content).toBe('Here is the answer.');
        expect(toolsMock).not.toHaveBeenCalled();
        const nudge = fetchMock.mock.calls[1][0] as {
            messages: { role: string; content: string | null }[];
        };
        expect(
            nudge.messages.some(
                (m) => typeof m.content === 'string' && m.content.includes('indicated a tool call')
            )
        ).toBe(true);
    });

    it('nudges once for tool-use-with-no-calls, then forces a tools-disabled pass', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(toolUseNoCallsMessage()))
            .mockResolvedValueOnce(jsonResponse(toolUseNoCallsMessage()))
            // Forced final pass (tools disabled) actually answers.
            .mockResolvedValueOnce(jsonResponse(textMessage('Answer from what I have.')));

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'history?', timestamp: 1 }],
        });

        // One nudge, then the loop refuses to ship an empty reply: the final
        // pass runs with tools disabled and produces the answer.
        expect(result.rounds).toBe(2);
        expect(result.content).toBe('Answer from what I have.');
        const finalCall = fetchMock.mock.calls[2][0] as { tools?: unknown };
        expect(finalCall.tools).toBeUndefined();
    });

    it('keeps the final answer out of intermediateTexts when tools ran in that turn', async () => {
        fetchMock
            .mockResolvedValueOnce(
                jsonResponse({
                    choices: [{
                        finish_reason: 'tool_calls',
                        message: {
                            content: 'Let me go dig.',
                            tool_calls: [{
                                id: 'call_1',
                                type: 'function',
                                function: { name: 'get_day', arguments: '{"date":"yesterday"}' },
                            }],
                        },
                    }],
                    usage: { prompt_tokens: 500, completion_tokens: 20, total_tokens: 520 },
                })
            )
            .mockResolvedValueOnce(jsonResponse(textMessage('Yesterday was about sleep debt.')));

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'yesterday?', timestamp: 1 }],
        });

        expect(result.content).toBe('Yesterday was about sleep debt.');
        expect(result.intermediateTexts).toEqual([{ round: 1, text: 'Let me go dig.' }]);
        expect(result.content).not.toBe('Let me go dig.');
    });
});
