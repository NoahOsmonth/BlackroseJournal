import { completeChat, Message, streamChat } from '../services/ai';
import { postAgent } from '../services/agent/agentClient';

jest.mock('../services/agent/agentClient', () => ({
    postAgent: jest.fn(),
}));

const mockPostAgent = postAgent as jest.MockedFunction<typeof postAgent>;

describe('ai service fallback parsing', () => {
    const messages: Message[] = [
        {
            id: '1',
            role: 'user',
            content: 'hello',
            timestamp: Date.now(),
        },
    ];

    afterEach(() => {
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

        mockPostAgent.mockResolvedValue(
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

        mockPostAgent.mockResolvedValue(
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

        mockPostAgent.mockResolvedValue(
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

    it('streams progressively with WebSocket when enabled', async () => {
        const originalTransport = process.env.AGENT_STREAMING_TRANSPORT;
        process.env.AGENT_STREAMING_TRANSPORT = 'ws';

        class MockWebSocket {
            static instances: MockWebSocket[] = [];
            onopen: (() => void) | null = null;
            onmessage: ((event: { data: string }) => void) | null = null;
            onerror: (() => void) | null = null;
            onclose: (() => void) | null = null;

            constructor() {
                MockWebSocket.instances.push(this);
                setTimeout(() => this.onopen?.(), 0);
            }

            send(): void {
                this.onmessage?.({
                    data: JSON.stringify({ type: 'delta', content: 'Hello ', reasoning: 'step 1' }),
                });
                this.onmessage?.({
                    data: JSON.stringify({ type: 'delta', content: 'world' }),
                });
                this.onmessage?.({
                    data: JSON.stringify({ type: 'done' }),
                });
            }

            close(): void {
                this.onclose?.();
            }
        }

        const originalWebSocket = global.WebSocket;
        (global as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;

        mockPostAgent.mockResolvedValue(
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
            expect(mockPostAgent).not.toHaveBeenCalled();
            expect(onChunk).toHaveBeenCalled();
            expect(onComplete).toHaveBeenCalledWith('Hello world', 'step 1');
        } finally {
            (global as unknown as { WebSocket: typeof originalWebSocket }).WebSocket = originalWebSocket;
            process.env.AGENT_STREAMING_TRANSPORT = originalTransport;
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
        mockPostAgent.mockImplementation(() => new Promise<Response>(() => {
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

        mockPostAgent.mockResolvedValue(
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
        mockPostAgent.mockResolvedValue(
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
        const [, payload] = mockPostAgent.mock.calls[0] as [string, Record<string, unknown>];
        expect(payload).not.toHaveProperty('memoryNamespace');
    });
});
