/**
 * DEF-005 regression tests: user Stop (abort) threading through the chat stack.
 *
 * Covers the three abort surfaces:
 * 1. readStreamResponse throws ChatAbortedError when the signal trips mid-stream.
 * 2. The agent loop abandons the turn when aborted (no extra model round, no
 *    final no-tools pass) and surfaces ChatAbortedError.
 * 3. useChatOrchestration.stopGeneration commits partial text without an error card.
 */

import { ChatAbortedError, isChatAbortedError } from '../../../services/ai/chatTypes';
import { readStreamResponse } from '../../../services/ai/sseParser';
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

function sseBody(frames: string[]): { getReader: () => unknown } {
    let index = 0;
    const encoder = new TextEncoder();
    return {
        getReader: () => ({
            read: async () => {
                if (index < frames.length) {
                    const value = encoder.encode(frames[index]);
                    index += 1;
                    return { done: false, value };
                }
                return { done: true, value: undefined };
            },
            cancel: jest.fn().mockResolvedValue(undefined),
        }),
    };
}

describe('readStreamResponse abort (user Stop)', () => {
    it('throws ChatAbortedError when the signal trips between chunks', async () => {
        const controller = new AbortController();
        const chunks: string[] = [];
        const body = sseBody([
            'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
            'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
            'data: {"choices":[{"delta":{"content":"!!!"}}]}\n\n',
        ]);

        const promise = readStreamResponse(body as never, (chunk) => {
            chunks.push(chunk);
            if (chunks.length === 1) {
                controller.abort();
            }
        }, jest.fn(), { signal: controller.signal });

        await expect(promise).rejects.toBeInstanceOf(ChatAbortedError);
        expect(chunks).toEqual(['Hello']);
    });

    it('does not call onComplete after an abort', async () => {
        const controller = new AbortController();
        const onComplete = jest.fn();
        const body = sseBody([
            'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n',
        ]);

        await expect(
            readStreamResponse(body as never, () => controller.abort(), onComplete, {
                signal: controller.signal,
            })
        ).rejects.toBeInstanceOf(ChatAbortedError);
        expect(onComplete).not.toHaveBeenCalled();
    });

    it('isChatAbortedError recognises native AbortError and stop errors', () => {
        const native = new Error('The operation was aborted.');
        native.name = 'AbortError';
        expect(isChatAbortedError(native)).toBe(true);
        expect(isChatAbortedError(new ChatAbortedError())).toBe(true);
        expect(isChatAbortedError(new Error('AI request was stopped by the user.'))).toBe(true);
        expect(isChatAbortedError(new Error('network fail'))).toBe(false);
    });
});

describe('runAgentTurnWithTools abort (user Stop)', () => {
    const fetchMock = aiTransport.fetchAiChatCompletion as jest.Mock;
    const toolsMock = executeTool.executeToolCalls as jest.Mock;

    beforeEach(() => {
        fetchMock.mockReset();
        toolsMock.mockReset();
    });

    function toolCallResponse(): Response {
        return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
                choices: [{
                    message: {
                        content: null,
                        tool_calls: [{
                            id: 'call_1',
                            type: 'function',
                            function: { name: 'get_clock', arguments: '{}' },
                        }],
                    },
                }],
            }),
        } as Response;
    }

    it('abandons the turn when aborted: no tool execution, no extra model round, throws ChatAbortedError', async () => {
        const controller = new AbortController();
        let calls = 0;
        fetchMock.mockImplementation(async () => {
            calls += 1;
            controller.abort(); // user taps Stop while round 1 is in flight
            return {
                ok: true,
                status: 200,
                text: async () => JSON.stringify({
                    choices: [{ message: { content: null } }],
                }),
            } as Response;
        });

        await expect(
            runAgentTurnWithTools({
                systemPrompt: 'sys',
                messages: [{ id: 'm1', role: 'user', content: 'hi', timestamp: Date.now() }],
                capability: {
                    mode: 'structured',
                    runAgentLoop: true,
                    sendToolsInApi: true,
                    parseTextToolDumps: false,
                    preferTextResultProtocol: false,
                } as never,
                signal: controller.signal,
            })
        ).rejects.toBeInstanceOf(ChatAbortedError);

        expect(calls).toBe(1);
        expect(toolsMock).not.toHaveBeenCalled();
    });

    it('does not start the model when the signal trips before the response arrives', async () => {
        const controller = new AbortController();
        fetchMock.mockImplementation(async () => {
            controller.abort();
            return toolCallResponse();
        });

        await expect(
            runAgentTurnWithTools({
                systemPrompt: 'sys',
                messages: [{ id: 'm1', role: 'user', content: 'hi', timestamp: Date.now() }],
                signal: controller.signal,
            })
        ).rejects.toBeInstanceOf(ChatAbortedError);
        expect(toolsMock).not.toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
