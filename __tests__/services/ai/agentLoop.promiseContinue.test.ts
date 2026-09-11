/**
 * Pi keep-alive: the loop must not ship a "one sec" status line as the answer.
 * Sibling of agentLoop.test.ts — mocks transport + executeToolCalls.
 */
import {
    AGENT_EXHAUSTION_FALLBACK,
    runAgentTurnWithTools,
} from '../../../services/ai/agentLoop';
import { PROMISE_CONTINUATION_MAX } from '../../../services/ai/agentPromise';
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

const PROMISE = 'Let me actually go dig rather than guess. One sec.';

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
                tool_calls: [{ id, type: 'function', function: { name, arguments: args } }],
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

describe('runAgentTurnWithTools promise keep-alive', () => {
    const fetchMock = aiTransport.fetchAiChatCompletion as jest.Mock;
    const toolsMock = executeTool.executeToolCalls as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        toolsMock.mockResolvedValue([
            { toolCallId: 'call_1', name: 'get_day', content: 'date: 2026-07-12\nsummary: Sleep' },
        ]);
    });

    it('continues past a promise-only turn after tools and ships the real answer', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(toolCallMessage('get_day', '{"date":"yesterday"}')))
            .mockResolvedValueOnce(jsonResponse(textMessage(PROMISE)))
            .mockResolvedValueOnce(
                jsonResponse(textMessage('Yesterday you wrote about broken sleep and the deck.'))
            );

        const events: AgentActivityEvent[] = [];
        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'What about yesterday?', timestamp: 1 }],
            onActivity: (event) => events.push(event),
        });

        expect(result.usedTools).toBe(true);
        expect(result.rounds).toBe(3);
        expect(result.stopReason).toBe('complete');
        expect(result.promiseContinuations).toBe(1);
        // The promise line is never the answer.
        expect(result.content).toBe('Yesterday you wrote about broken sleep and the deck.');
        expect(result.content).not.toBe(PROMISE);
        // It IS captured as intermediate voice for the UI.
        expect(result.intermediateTexts).toEqual([{ round: 2, text: PROMISE }]);
        expect(events.some((e) => e.type === 'follow_up_injected' && e.reason === 'promised_more')).toBe(true);
        expect(
            events.some((e) => e.type === 'assistant_text_end' && e.text === PROMISE)
        ).toBe(true);

        // The keep-alive note reached the model on the turn after the promise.
        const thirdRequest = fetchMock.mock.calls[2][0] as {
            messages: { role: string; content: string | null }[];
        };
        expect(
            thirdRequest.messages.some(
                (m) => typeof m.content === 'string' && m.content.includes('Do not stop on a status line')
            )
        ).toBe(true);
    });

    it('continues a promise on the first turn even with no prior tools', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(textMessage('One sec — checking yesterday.')))
            .mockResolvedValueOnce(jsonResponse(textMessage('Here is the real answer.')));

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'history?', timestamp: 1 }],
        });

        expect(result.usedTools).toBe(false);
        expect(result.rounds).toBe(2);
        expect(result.content).toBe('Here is the real answer.');
        expect(result.promiseContinuations).toBe(1);
    });

    it('caps promise spam at PROMISE_CONTINUATION_MAX then forces a final no-tools pass (stopReason promised_more_timeout)', async () => {
        // 4 promise turns, then the forced pass answers properly.
        fetchMock
            .mockResolvedValueOnce(jsonResponse(toolCallMessage('get_clock', '{}')))
            .mockResolvedValueOnce(jsonResponse(textMessage('Still searching through the digests.')))
            .mockResolvedValueOnce(jsonResponse(textMessage('Digging deeper now.')))
            .mockResolvedValueOnce(jsonResponse(textMessage('Hold on, let me check.')))
            .mockResolvedValueOnce(jsonResponse(textMessage('The real answer at last.')));

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'what did I write?', timestamp: 1 }],
            maxRounds: 6,
        });

        expect(PROMISE_CONTINUATION_MAX).toBe(2);
        expect(result.promiseContinuations).toBe(2);
        expect(result.stopReason).toBe('promised_more_timeout');
        expect(result.content).toBe('The real answer at last.');
        // Every promise line is preserved as intermediate text, none as the answer.
        expect(result.intermediateTexts?.map((t) => t.text)).toEqual([
            'Still searching through the digests.',
            'Digging deeper now.',
            'Hold on, let me check.',
        ]);
        // The forced pass ran with tools disabled and carried the stop note.
        const finalRequest = fetchMock.mock.calls[4][0] as {
            messages: { role: string; content: string | null }[];
            tools?: unknown;
        };
        expect(finalRequest.tools).toBeUndefined();
        expect(
            finalRequest.messages.some(
                (m) => typeof m.content === 'string' && m.content.includes('stop looking')
            )
        ).toBe(true);
    });

    it('never ships a promise even when the forced final pass also returns one', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(toolCallMessage('get_clock', '{}')))
            .mockResolvedValueOnce(jsonResponse(textMessage('One sec.')))
            .mockResolvedValueOnce(jsonResponse(textMessage('Let me check that day.')))
            .mockResolvedValueOnce(jsonResponse(textMessage('Hold on, still looking.')))
            // Forced tools-disabled pass also misbehaves:
            .mockResolvedValueOnce(jsonResponse(textMessage('One second, digging deeper.')));

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'what did I write?', timestamp: 1 }],
        });

        expect(result.content).toBe(AGENT_EXHAUSTION_FALLBACK);
        expect(result.content).not.toMatch(/one sec/i);
        expect(result.stopReason).toBe('promised_more_timeout');
    });

    it('does not loop when the first no-tools turn is a real answer', async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse(textMessage('You wrote about the deck going out three times.'))
        );

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'what did I write?', timestamp: 1 }],
        });

        expect(result.rounds).toBe(1);
        expect(result.promiseContinuations).toBe(0);
        expect(result.intermediateTexts).toEqual([]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('answers immediately when the last tool turn already produced the final prose', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(toolCallMessage('get_day', '{"date":"today"}')))
            .mockResolvedValueOnce(jsonResponse(textMessage('Today you wrote about the deck.')));

        const result = await runAgentTurnWithTools({
            systemPrompt: 'sys',
            messages: [{ id: '1', role: 'user', content: 'today?', timestamp: 1 }],
        });

        expect(result.content).toBe('Today you wrote about the deck.');
        expect(result.rounds).toBe(2);
        expect(result.promiseContinuations).toBe(0);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
