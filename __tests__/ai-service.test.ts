import { completeChat, Message, streamChat } from '../services/ai';

// Mock the direct config so URL + Authorization + model are deterministic.
jest.mock('../services/ai/directConfig', () => ({
    getDirectConfig: () => ({
        apiKey: 'sk-direct-test-key',
        apiBaseUrl: 'https://nano-gpt.com/api/v1',
        model: 'nvidia/nemotron-3-ultra-550b-a55b',
        flashModel: 'nvidia/nemotron-3-ultra-550b-a55b',
    }),
    getResolvedDirectConfig: () => Promise.resolve({
        apiKey: 'sk-direct-test-key',
        apiBaseUrl: 'https://nano-gpt.com/api/v1',
        model: 'nvidia/nemotron-3-ultra-550b-a55b',
        flashModel: 'nvidia/nemotron-3-ultra-550b-a55b',
        source: 'env',
        contextWindow: 32_768,
        contextWindowSource: 'fallback',
    }),
}));

jest.mock('../services/ai/customModels', () => ({
    ...jest.requireActual('../services/ai/customModels'),
    getKnownContextWindow: () => 32_768,
}));

/** Install a constructable XHR mock on both `global` and `globalThis` (Jest/node parity). */
function installXhrMock(MockCtor: new () => unknown): () => void {
    const targets = [globalThis, global] as Record<string, unknown>[];
    const previous = targets.map((target) => ({
        target,
        value: target.XMLHttpRequest,
        descriptor: Object.getOwnPropertyDescriptor(target, 'XMLHttpRequest'),
    }));
    for (const target of targets) {
        Object.defineProperty(target, 'XMLHttpRequest', {
            configurable: true,
            writable: true,
            value: MockCtor,
        });
    }
    return () => {
        for (const entry of previous) {
            if (entry.descriptor) {
                Object.defineProperty(entry.target, 'XMLHttpRequest', entry.descriptor);
            } else {
                delete entry.target.XMLHttpRequest;
                if (entry.value !== undefined) {
                    entry.target.XMLHttpRequest = entry.value;
                }
            }
        }
    };
}

/** Drain microtasks until predicate is true (streamChat does several awaits before XHR). */
async function flushUntil(predicate: () => boolean, maxTicks = 40): Promise<void> {
    for (let i = 0; i < maxTicks; i += 1) {
        if (predicate()) return;
        await Promise.resolve();
    }
}

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
            usage: null,
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

        const restoreXhr = installXhrMock(MockXmlHttpRequest);

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
            await streamChat(messages, onChunk, onComplete, onError, { enableHistoryTools: false });
            // onError never: genuine "no failure path" check (fail if any error callback).
            expect(onError).not.toHaveBeenCalled();
            // Content, not mere call-presence — wrong SSE parse would break these.
            expect(onChunk).toHaveBeenCalledWith('Hello ', 'step 1');
            expect(onChunk).toHaveBeenCalledWith('there', undefined);
            expect(onComplete).toHaveBeenCalledWith('Hello there', 'step 1');
        } finally {
            restoreXhr();
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

        const restoreXhr = installXhrMock(MockXmlHttpRequest);
        fetchMock.mockImplementation(() => new Promise<Response>(() => {
            // intentionally unresolved: proves we must not wait for fetch first
        }));

        const onChunk = jest.fn();
        const onComplete = jest.fn();
        const onError = jest.fn();

        try {
            void streamChat(messages, onChunk, onComplete, onError, { enableHistoryTools: false });
            // streamChat awaits context resolve + compact + prepareDirectChatRequest before XHR
            await flushUntil(() => onComplete.mock.calls.length > 0);

            expect(onError).not.toHaveBeenCalled();
            expect(onChunk).toHaveBeenCalledWith('live ', undefined);
            expect(onComplete).toHaveBeenCalledWith('live ', '');
            // Fetch must still be pending — XHR path is what completed the stream.
            expect(fetchMock).not.toHaveBeenCalled();
        } finally {
            restoreXhr();
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

        const restoreXhr = installXhrMock(MockXmlHttpRequest);

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
            const pending = streamChat(messages, onChunk, onComplete, onError, {
                enableHistoryTools: false,
            });

            await flushUntil(() => onChunk.mock.calls.length > 0);
            expect(onChunk).toHaveBeenCalledWith('Hello ', undefined);

            jest.advanceTimersByTime(10);
            await pending;

            expect(onError).not.toHaveBeenCalled();
            expect(onChunk).toHaveBeenCalledWith('Hello ', undefined);
            expect(onChunk).toHaveBeenCalledWith('world', undefined);
            expect(onComplete).toHaveBeenCalledWith('Hello world', '');
        } finally {
            restoreXhr();
        }
    });

    it('does not send memoryNamespace in chat payloads', async () => {
        fetchMock.mockResolvedValue(
            new Response([
                'data: {"choices":[{"delta":{"content":"ok"}}]}',
                'data: [DONE]',
                '',
            ].join('\n'), {
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
        expect(body.model).toBe('nvidia/nemotron-3-ultra-550b-a55b');
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
