jest.mock('../backend/src/agent/modelClient', () => ({
    createChatCompletionStream: jest.fn(),
    createChatCompletion: jest.fn(),
}));

jest.mock('../backend/src/agent/simpleMemService', () => ({
    retrieveLongTermMemoryContext: jest.fn(async () => ''),
    storeMessageInLongTermMemory: jest.fn(async () => undefined),
}));

import { createChatCompletionStream } from '../backend/src/agent/modelClient';
import { storeMessageInLongTermMemory } from '../backend/src/agent/simpleMemService';
import { handleChatCompletionStream } from '../backend/src/agent/agentService';

const mockCreateChatCompletionStream = createChatCompletionStream as jest.MockedFunction<
    typeof createChatCompletionStream
>;

const mockStoreMessageInLongTermMemory = storeMessageInLongTermMemory as jest.MockedFunction<
    typeof storeMessageInLongTermMemory
>;

async function flushMicrotasks(rounds = 6): Promise<void> {
    for (let i = 0; i < rounds; i++) {
        await new Promise<void>((resolve) => setImmediate(resolve));
    }
}

describe('backend streaming memory persistence', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('stores assistant content from SSE stream responses', async () => {
        const ssePayload = [
            'data: {"choices":[{"delta":{"role":"assistant"}}]}',
            'data: {"choices":[{"delta":{"content":"Hello "}}]}',
            'data: {"choices":[{"delta":{"content":"world"}}]}',
            'data: [DONE]',
            '',
        ].join('\n\n');

        mockCreateChatCompletionStream.mockResolvedValue(
            new Response(ssePayload, {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream' },
            })
        );

        const response = await handleChatCompletionStream({
            messages: [
                { role: 'system', content: 'sys' },
                { role: 'user', content: 'hi' },
            ],
            stream: true,
        });

        expect(response.ok).toBe(true);

        // Give the background stream consumer time to parse and persist.
        await flushMicrotasks();

        const assistantCalls = mockStoreMessageInLongTermMemory.mock.calls.filter(
            ([role]) => role === 'assistant'
        );

        expect(assistantCalls.length).toBeGreaterThan(0);
        expect(assistantCalls[assistantCalls.length - 1]?.[1]).toBe('Hello world');
    });
});

