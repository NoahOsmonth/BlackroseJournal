import { completeChat, Message, streamChat } from '../services/ai';

// Mock the direct config so URL + Authorization + model are deterministic.
jest.mock('../services/ai/directConfig', () => ({
    getDirectConfig: () => ({
        apiKey: 'sk-direct-test-key',
        apiBaseUrl: 'https://nano-gpt.com/api/v1',
        model: 'moonshotai/kimi-k2.5:thinking',
        flashModel: 'moonshotai/kimi-k2.5',
    }),
    getResolvedDirectConfig: () => Promise.resolve({
        apiKey: 'sk-direct-test-key',
        apiBaseUrl: 'https://nano-gpt.com/api/v1',
        model: 'moonshotai/kimi-k2.5:thinking',
        flashModel: 'moonshotai/kimi-k2.5',
        source: 'env',
    }),
}));

describe('ai service fallback parsing', () => {
    const messages: Message[] = [
        {
            id: '1',
            role: 'user',
            content: 'hello',
            timestamp: Date.now(),
        },
    ];

    const originalFetch = global.fetch;
    let fetchMock: jest.Mock;

    beforeEach(() => {
        fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    it('parses SSE transcript when non-streaming JSON parse fails', async () => {
        const ssePayload = [
            'data: {"choices":[{"delta":{"content":"Hello ","reasoning":"warm opening"}}]}',
            'data: {"choices":[{"delta":{"content":"world"}}]}',
            'data: [DONE]',
            '',
        ].join('\n');

        fetchMock.mockResolvedValue(
            new Response(ssePayload, {
                status: 200,
                headers: { 'Content-Type': 'text/plain' },
            })
        );

        const result = await completeChat(messages, 'system prompt');

        expect(result).toEqual({
            content: 'Hello world',
            reasoning: 'warm opening',
        });
    });

    it('emits flowing chunk callbacks when fallback response is SSE transcript', async () => {
        jest.useFakeTimers();
        const content = 'This should appear in several flowing chunks for the UI.';
        const ssePayload = [
            `data: {"choices":[{"delta":{"content":"${content}","reasoning":"first"}}]}`,
            'data: [DONE]',
            '',
        ].join('\n');

        fetchMock.mockResolvedValue(
            new Response(ssePayload, {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const onChunk = jest.fn();
        const onComplete = jest.fn();
        const onError = jest.fn();

        const pending = streamChat(messages, onChunk, onComplete, onError);
        await jest.runAllTimersAsync();
        await pending;

        expect(onError).not.toHaveBeenCalled();
        expect(onChunk.mock.calls.length).toBeGreaterThan(1);
        expect(onComplete).toHaveBeenCalledWith(content, 'first');
    });

    it('streams progressively with XMLHttpRequest fallback when fetch stream is unavailable', async () => {
        class MockXmlHttpRequest {
            static instances: MockXmlHttpRequest[] = [];
            onprogress: (() => void) | null = null;
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            status = 200;
            responseText = '';

            constructor() {
                MockXmlHttpRequest.instances.push(this);
            }

            open(): void {
                // no-op
            }

            setRequestHeader(): void {
                // no-op
            }

            send(): void {
                this.responseText += 'data: {"choices":[{"delta":{"content":"Hello ","reasoning":"step 1"}}]}\n\n';
                this.onprogress?.();
                this.responseText += 'data: {"choices":[{"delta":{"content":"there"}}]}\n\n';
                this.onprogress?.();
                this.responseText += 'data: [DONE]\n\n';
                this.onload?.();
            }
        }

        const originalXhr = global.XMLHttpRequest;
        (global as unknown as { XMLHttpRequest: typeof MockXmlHttpRequest }).XMLHttpRequest = MockXmlHttpRequest;

        fetchMock.mockResolvedValue(
            new Response('{}', {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const onChunk = jest.fn();
        const onComplete = jest.fn();
        const onError = jest.fn();

        try {
            await streamChat(messages, onChunk, onComplete, onError);
            expect(onError).not.toHaveBeenCalled();
            expect(onChunk).toHaveBeenCalled();
            expect(onComplete).toHaveBeenCalledWith('Hello there', 'step 1');
        } finally {
            (global as unknown as { XMLHttpRequest: typeof originalXhr }).XMLHttpRequest = originalXhr;
        }
    });

    it('starts xhr streaming without waiting for fetch response to finish', async () => {
        class MockXmlHttpRequest {
            onprogress: (() => void) | null = null;
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            onreadystatechange: (() => void) | null = null;
            status = 200;
            responseText = '';
            readyState = 0;

            open(): void {
                // no-op
            }

            setRequestHeader(): void {
                // no-op
            }

            send(): void {
                this.responseText += 'data: {"choices":[{"delta":{"content":"live "}}]}\n\n';
                this.readyState = 3;
                this.onreadystatechange?.();
                this.responseText += 'data: [DONE]\n\n';
                this.readyState = 4;
                this.onreadystatechange?.();
                this.onload?.();
            }
        }

        const originalXhr = global.XMLHttpRequest;
        (global as unknown as { XMLHttpRequest: typeof MockXmlHttpRequest }).XMLHttpRequest = MockXmlHttpRequest;
        fetchMock.mockImplementation(() => new Promise<Response>(() => {
            // intentionally unresolved: proves we must not wait for fetch first
        }));

        const onChunk = jest.fn();
        const onComplete = jest.fn();
        const onError = jest.fn();

        try {
            void streamChat(messages, onChunk, onComplete, onError);
            await Promise.resolve();
            await Promise.resolve();

            expect(onError).not.toHaveBeenCalled();
            expect(onChunk).toHaveBeenCalledWith('live ', undefined);
            expect(onComplete).toHaveBeenCalledWith('live ', '');
        } finally {
            (global as unknown as { XMLHttpRequest: typeof originalXhr }).XMLHttpRequest = originalXhr;
        }
    });

    it('streams progressively when only onreadystatechange fires (no onprogress)', async () => {
        jest.useFakeTimers();
        class MockXmlHttpRequest {
            onprogress: (() => void) | null = null;
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            onreadystatechange: (() => void) | null = null;
            status = 200;
            responseText = '';
            readyState = 0;

            open(): void {
                // no-op
            }

            setRequestHeader(): void {
                // no-op
            }

            send(): void {
                this.responseText += 'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n';
                this.readyState = 3;
                this.onreadystatechange?.();

                setTimeout(() => {
                    this.responseText += 'data: {"choices":[{"delta":{"content":"world"}}]}\n\n';
                    this.readyState = 3;
                    this.onreadystatechange?.();
                    this.responseText += 'data: [DONE]\n\n';
                    this.readyState = 4;
                    this.onreadystatechange?.();
                    this.onload?.();
                }, 10);
            }
        }

        const originalXhr = global.XMLHttpRequest;
        (global as unknown as { XMLHttpRequest: typeof MockXmlHttpRequest }).XMLHttpRequest = MockXmlHttpRequest;

        fetchMock.mockResolvedValue(
            new Response('{}', {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const onChunk = jest.fn();
        const onComplete = jest.fn();
        const onError = jest.fn();

        try {
            const pending = streamChat(messages, onChunk, onComplete, onError);

            await Promise.resolve();
            await Promise.resolve();
            expect(onChunk).toHaveBeenCalledWith('Hello ', undefined);

            jest.advanceTimersByTime(10);
            await pending;

            expect(onError).not.toHaveBeenCalled();
            expect(onChunk).toHaveBeenCalled();
            expect(onComplete).toHaveBeenCalledWith('Hello world', '');
        } finally {
            (global as unknown as { XMLHttpRequest: typeof originalXhr }).XMLHttpRequest = originalXhr;
        }
    });

    it('does not send memoryNamespace in chat payloads', async () => {
        fetchMock.mockResolvedValue(
            new Response('data: [DONE]\n\n', {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream' },
            })
        );

        const onChunk = jest.fn();
        const onComplete = jest.fn();
        const onError = jest.fn();

        await streamChat(messages, onChunk, onComplete, onError);

        expect(onError).not.toHaveBeenCalled();
        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        expect(body).not.toHaveProperty('memoryNamespace');
    });

    it('hits the NanoGPT chat-completions URL with Authorization and Kimi thinking model', async () => {
        fetchMock.mockResolvedValue(
            new Response(JSON.stringify({
                choices: [{ message: { content: 'ok', reasoning: '' } }],
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        await completeChat(messages, 'system prompt');

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('https://nano-gpt.com/api/v1/chat/completions');
        const headers = init.headers as Record<string, string>;
        expect(headers.Authorization).toBe('Bearer sk-direct-test-key');
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        expect(body.model).toBe('moonshotai/kimi-k2.5:thinking');
    });

    it('surfaces a friendly error when NanoGPT returns 401', async () => {
        fetchMock.mockResolvedValue(
            new Response('{"error":{"message":"invalid api key"}}', {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const onError = jest.fn();
        await streamChat(messages, jest.fn(), jest.fn(), onError);

        expect(onError).toHaveBeenCalledTimes(1);
        const err = onError.mock.calls[0][0] as Error;
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toMatch(/401/);
    });

    it('surfaces a friendly error when NanoGPT returns 429', async () => {
        fetchMock.mockResolvedValue(
            new Response('{"error":{"message":"rate limited"}}', {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        await expect(completeChat(messages, 'system prompt'))
            .rejects
            .toThrow(/429/);
    });
});
