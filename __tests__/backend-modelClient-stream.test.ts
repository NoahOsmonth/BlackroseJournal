jest.mock('../backend/src/config/aiConfig', () => ({
    getAiConfig: jest.fn(() => ({
        apiBaseUrl: 'https://nano-gpt.com/api/v1',
        apiKey: 'test-key',
        model: 'test-model',
    })),
}));

import { createChatCompletionStream } from '../backend/src/agent/modelClient';

describe('backend modelClient streaming', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.clearAllMocks();
    });

    it('requests upstream chat completions with stream=true and SSE accept header', async () => {
        const fetchMock = jest.fn().mockResolvedValue(
            new Response('data: [DONE]\n\n', {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream' },
            })
        );
        global.fetch = fetchMock as unknown as typeof fetch;

        const response = await createChatCompletionStream([
            { role: 'system', content: 'sys' },
            { role: 'user', content: 'hello' },
        ]);

        expect(response.ok).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(String(request.body)) as { stream: boolean };
        expect(body.stream).toBe(true);
        expect((request.headers as Record<string, string>).Accept).toBe('text/event-stream');
    });
});

