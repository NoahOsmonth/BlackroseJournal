/**
 * Strict finality + capability-tier behaviour in the turn loop (Plan v2 §4.2/§4.3/§6).
 *
 * Covers the paths that decide whether a turn IS the answer:
 * - a dump-shaped turn with nothing parsed never ships raw syntax
 * - tier A (structured) models do not get the free-model dump nudge
 * - an empty turn never becomes the reply
 * - truncation / toolUse-zero nudges announce themselves on the event stream
 * - last-round narration is kept as intermediate voice, not as the answer
 *
 * Sibling of agentLoop.stopReason.test.ts — mocks transport + executeToolCalls.
 */
import { AGENT_EXHAUSTION_FALLBACK, runAgentTurnWithTools } from '../../../services/ai/agentLoop';
import type { AgentActivityEvent } from '../../../services/ai/agentEvents';
import * as aiTransport from '../../../services/ai/aiTransport';
import { resolveToolCapability } from '../../../services/ai/tools/toolCapability';
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

/** Tier constants come from the real resolver so the test cannot drift from routing. */
const TIER_A = resolveToolCapability('openai/gpt-4o');
/** A genuinely hybrid route — the dump-repair tier this suite exercises. */
const TIER_B = resolveToolCapability('cl/dots-studio/dots-3-note-preview:free');

/** A stable stem of TEXT_TOOL_NUDGE (the free-model "stop writing dumps" note). */
const NUDGE_STEM = 'not a user-facing reply';

/** A dump shape the parser cannot extract: unquoted JSON in an unknown tag. */
const UNPARSEABLE_DUMP =
    '<widget_call>{"name":"get_day","arguments":{"date":yesterday}}</widget_call>';

function jsonResponse(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => JSON.stringify(body),
    } as Response;
}

function textMessage(content: string, finishReason = 'stop') {
    return {
        choices: [{ finish_reason: finishReason, message: { content, reasoning_content: '' } }],
        usage: { prompt_tokens: 400, completion_tokens: 30, total_tokens: 430 },
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

function toolUseNoCallsMessage() {
    return {
        choices: [{ finish_reason: 'tool_calls', message: { content: null, tool_calls: [] } }],
        usage: { prompt_tokens: 500, completion_tokens: 10, total_tokens: 510 },
    };
}

function truncatedMessage() {
    return {
        choices: [{
            finish_reason: 'length',
            message: {
                content: null,
                tool_calls: [{
                    id: 'call_1',
                    type: 'function',
                    function: {
                        name: 'get_conversation',
                        arguments: '{"kind":"journal_entry","id":"entry_abc',
                    },
                }],
            },
        }],
        usage: { prompt_tokens: 500, completion_tokens: 1536, total_tokens: 2036 },
    };
}

const USER_TURN = {
    systemPrompt: 'sys',
    messages: [{ id: '1', role: 'user' as const, content: 'what did I write?', timestamp: 1 }],
};

describe('turn finality', () => {
    const fetchMock = aiTransport.fetchAiChatCompletion as jest.Mock;
    const toolsMock = executeTool.executeToolCalls as jest.Mock;

    beforeEach(() => {
        fetchMock.mockReset();
        toolsMock.mockReset();
        toolsMock.mockResolvedValue([
            { toolCallId: 'call_1', name: 'get_day', content: 'summary: Sleep was rough' },
        ]);
    });

    it('never ships an unparseable tool dump as the final answer (tier A)', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(textMessage(UNPARSEABLE_DUMP)))
            // Forced no-tools pass owns the answer once the dump is refused.
            .mockResolvedValueOnce(jsonResponse(textMessage('Here is what I found.')));

        const events: AgentActivityEvent[] = [];
        const result = await runAgentTurnWithTools({
            ...USER_TURN,
            capability: TIER_A,
            onActivity: (event) => events.push(event),
        });

        expect(result.stopReason).toBe('skipped');
        expect(result.content).toBe('Here is what I found.');
        expect(result.content).not.toContain('widget_call');
        // The dump was refused outright — no dump nudge for a structured model.
        const nudge = fetchMock.mock.calls[1][0] as {
            messages: { role: string; content: string | null }[];
        };
        expect(
            nudge.messages.some(
                (m) => typeof m.content === 'string' && m.content.includes(NUDGE_STEM)
            )
        ).toBe(false);
        expect(events.some((e) => e.type === 'follow_up_injected')).toBe(false);
    });

    it('still nudges a dump on a hybrid (free) model', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(textMessage(UNPARSEABLE_DUMP)))
            // The nudge gets a real structured call.
            .mockResolvedValueOnce(jsonResponse(toolUseMessage('get_day', '{"date":"yesterday"}')))
            .mockResolvedValueOnce(jsonResponse(textMessage('Yesterday was about sleep.')));

        const result = await runAgentTurnWithTools({ ...USER_TURN, capability: TIER_B });

        expect(result.usedTools).toBe(true);
        expect(result.rounds).toBe(3);
        expect(result.content).toBe('Yesterday was about sleep.');
        const nudge = fetchMock.mock.calls[1][0] as {
            messages: { role: string; content: string | null }[];
        };
        expect(
            nudge.messages.some(
                (m) => typeof m.content === 'string' && m.content.includes(NUDGE_STEM)
            )
        ).toBe(true);
    });

    it('never ships a blank reply when the turn is empty', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(textMessage('')))
            .mockResolvedValueOnce(jsonResponse(textMessage('Answer from what I already have.')));

        const result = await runAgentTurnWithTools(USER_TURN);

        expect(result.stopReason).toBe('skipped');
        expect(result.content).toBe('Answer from what I already have.');
    });

    it('falls back when the empty turn is also the last round', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(textMessage('')))
            .mockResolvedValueOnce(jsonResponse(textMessage('')));

        const result = await runAgentTurnWithTools(USER_TURN);

        expect(result.content).toBe(AGENT_EXHAUSTION_FALLBACK);
        expect(result.content.trim().length).toBeGreaterThan(0);
    });

    it('announces the truncation nudge as follow_up_injected(truncated_tools)', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(truncatedMessage()))
            .mockResolvedValueOnce(jsonResponse(textMessage('Recovered answer.')));

        const events: AgentActivityEvent[] = [];
        const result = await runAgentTurnWithTools({
            ...USER_TURN,
            onActivity: (event) => events.push(event),
        });

        expect(
            events.some((e) => e.type === 'follow_up_injected' && e.reason === 'truncated_tools')
        ).toBe(true);
        expect(result.content).toBe('Recovered answer.');
        expect(toolsMock).not.toHaveBeenCalled();
    });

    it('announces the tool-use-zero nudge as follow_up_injected(tooluse_no_calls)', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(toolUseNoCallsMessage()))
            .mockResolvedValueOnce(jsonResponse(textMessage('Answer anyway.')));

        const events: AgentActivityEvent[] = [];
        await runAgentTurnWithTools({ ...USER_TURN, onActivity: (event) => events.push(event) });

        expect(
            events.some((e) => e.type === 'follow_up_injected' && e.reason === 'tooluse_no_calls')
        ).toBe(true);
    });

    it('keeps last-round narration as intermediate voice, never as the answer', async () => {
        const narration = 'Let me look at the last three days for you.';
        fetchMock
            .mockResolvedValueOnce(jsonResponse(toolUseMessage('get_day', '{"date":"yesterday"}')))
            .mockResolvedValueOnce(
                jsonResponse({
                    choices: [{
                        finish_reason: 'tool_calls',
                        message: {
                            content: narration,
                            tool_calls: [{
                                id: 'call_2',
                                type: 'function',
                                function: { name: 'list_recent_days', arguments: '{"days":3}' },
                            }],
                        },
                    }],
                    usage: { prompt_tokens: 500, completion_tokens: 20, total_tokens: 520 },
                })
            )
            .mockResolvedValueOnce(jsonResponse(textMessage('Here is the real summary.')));

        toolsMock
            .mockResolvedValueOnce([{ toolCallId: 'call_1', name: 'get_day', content: 'ok' }])
            .mockResolvedValueOnce([{ toolCallId: 'call_2', name: 'list_recent_days', content: 'ok' }]);

        const result = await runAgentTurnWithTools({ ...USER_TURN, maxRounds: 2 });

        expect(result.stopReason).toBe('max_rounds');
        expect(result.content).toBe('Here is the real summary.');
        expect(result.content).not.toBe(narration);
        expect(result.intermediateTexts?.map((t) => t.text)).toContain(narration);
    });

    it('does not run tools when the provider claims tool use with none parsed', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(toolUseNoCallsMessage()))
            .mockResolvedValueOnce(jsonResponse(textMessage('No tools were run.')));

        const result = await runAgentTurnWithTools(USER_TURN);

        expect(toolsMock).not.toHaveBeenCalled();
        expect(result.usedTools).toBe(false);
    });
});
