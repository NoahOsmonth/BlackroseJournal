/**
 * PR3 — openai-compat adapter contract tests.
 *
 * The adapter is a thin transport. Tests assert the wire shape, the retry
 * policy, and the secret-redaction discipline. The fetch global is mocked
 * per-test so we can simulate upstream 4xx/5xx responses without going
 * over the wire.
 */
import {
    openaiCompatChat,
    openaiCompatStream,
} from '../../../backend/src/services/ai/adapters/openaiCompat';
import type {
    ChatRequest,
    ResolvedProfile,
} from '../../../backend/src/services/ai/provider';

const PROFILE: ResolvedProfile = {
    apiBaseUrl: 'https://nano-gpt.com/api/v1',
    apiKey: 'sk-test-secret-key-1234',
    model: 'moonshotai/kimi-k2.5:thinking',
    flashModel: 'moonshotai/kimi-k2.5',
    capabilities: {
        streaming: true,
        reasoning: true,
        reasoningField: 'reasoning_content',
        sseFormat: 'openai',
        authHeaderStyle: 'bearer',
    },
};

const BASE_REQ: ChatRequest = {
    messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hi' },
    ],
    temperature: 0.7,
    maxTokens: 256,
};

function mockJsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers },
    });
}

function mockSseResponse(status: number): Response {
    return new Response('data: [DONE]\n\n', {
        status,
        headers: { 'Content-Type': 'text/event-stream' },
    });
}

describe('openaiCompat adapter — wire shape', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    it('1. sends a body with ONLY model, messages, stream, temperature, max_tokens', async () => {
        const fetchMock = jest.fn().mockResolvedValue(
            mockJsonResponse(200, { choices: [{ message: { content: 'ok' } }] })
        );
        global.fetch = fetchMock as unknown as typeof fetch;

        await openaiCompatChat({ ...BASE_REQ, stream: false }, PROFILE);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('https://nano-gpt.com/api/v1/chat/completions');
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        expect(Object.keys(body).sort()).toEqual(
            ['max_tokens', 'messages', 'model', 'temperature']
        );
        expect(body).not.toHaveProperty('max_context');
        expect(body).not.toHaveProperty('reasoning');
        expect(body).not.toHaveProperty('reasoning_content');
        expect(body).not.toHaveProperty('reasoning_effort');
    });

    it('1b. forwards topP as top_p when provided', async () => {
        const fetchMock = jest.fn().mockResolvedValue(
            mockJsonResponse(200, { choices: [{ message: { content: 'ok' } }] })
        );
        global.fetch = fetchMock as unknown as typeof fetch;

        await openaiCompatChat({ ...BASE_REQ, topP: 0.65 }, PROFILE);

        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        expect(body.top_p).toBe(0.65);
    });

    it('2. sets Authorization: Bearer <key> on every call', async () => {
        const fetchMock = jest.fn().mockResolvedValue(
            mockJsonResponse(200, { choices: [{ message: { content: 'ok' } }] })
        );
        global.fetch = fetchMock as unknown as typeof fetch;

        await openaiCompatChat(BASE_REQ, PROFILE);

        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const headers = init.headers as Record<string, string>;
        expect(headers.Authorization).toBe(`Bearer ${PROFILE.apiKey}`);
        expect(headers['Content-Type']).toBe('application/json');
    });

    it('3. sets Accept: text/event-stream on streaming requests', async () => {
        const fetchMock = jest.fn().mockResolvedValue(mockSseResponse(200));
        global.fetch = fetchMock as unknown as typeof fetch;

        await openaiCompatStream({ ...BASE_REQ, stream: true }, PROFILE);

        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const headers = init.headers as Record<string, string>;
        expect(headers.Accept).toBe('text/event-stream');
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        expect(body.stream).toBe(true);
    });

    it('4. passes an AbortSignal.timeout-derived signal to fetch', async () => {
        const fetchMock = jest.fn().mockResolvedValue(
            mockJsonResponse(200, { choices: [{ message: { content: 'ok' } }] })
        );
        global.fetch = fetchMock as unknown as typeof fetch;

        await openaiCompatChat(BASE_REQ, PROFILE);

        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(init.signal).toBeDefined();
        expect(init.signal).toBeInstanceOf(AbortSignal);
        // 60s timeout signal must not be already aborted at construction time.
        expect((init.signal as AbortSignal).aborted).toBe(false);
    });

    it('5. combines the user-supplied signal with the timeout signal', async () => {
        const fetchMock = jest.fn().mockResolvedValue(
            mockJsonResponse(200, { choices: [{ message: { content: 'ok' } }] })
        );
        global.fetch = fetchMock as unknown as typeof fetch;

        const userController = new AbortController();
        await openaiCompatChat({ ...BASE_REQ, signal: userController.signal }, PROFILE);

        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const combined = init.signal as AbortSignal;
        expect(combined).toBeDefined();
        expect(combined).not.toBe(userController.signal);

        // Aborting the user signal must propagate to the combined signal.
        userController.abort();
        // Wait one microtask for the abort to propagate via the listener.
        await Promise.resolve();
        expect(combined.aborted).toBe(true);
    });
});

describe('openaiCompat adapter — retry policy', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        jest.useRealTimers();
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    it('6. retries once on 429 and succeeds on the second try', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce(mockJsonResponse(429, { error: 'rate limit' }))
            .mockResolvedValueOnce(
                mockJsonResponse(200, { choices: [{ message: { content: 'hi' } }] })
            );
        global.fetch = fetchMock as unknown as typeof fetch;

        const result = await openaiCompatChat(BASE_REQ, PROFILE);

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result.content).toBe('hi');
    });

    it('7. retries once on 503 and fails when the second try is also 503', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce(mockJsonResponse(503, { error: 'down' }))
            .mockResolvedValueOnce(mockJsonResponse(503, { error: 'still down' }));
        global.fetch = fetchMock as unknown as typeof fetch;

        await expect(openaiCompatChat(BASE_REQ, PROFILE)).rejects.toBeDefined();
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('8. does not retry on 401 and throws', async () => {
        const fetchMock = jest.fn().mockResolvedValue(mockJsonResponse(401, { error: 'no' }));
        global.fetch = fetchMock as unknown as typeof fetch;

        await expect(openaiCompatChat(BASE_REQ, PROFILE)).rejects.toBeDefined();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('9. does not retry on 400 and throws', async () => {
        const fetchMock = jest.fn().mockResolvedValue(mockJsonResponse(400, { error: 'bad' }));
        global.fetch = fetchMock as unknown as typeof fetch;

        await expect(openaiCompatChat(BASE_REQ, PROFILE)).rejects.toBeDefined();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('10. does not retry on 404 and throws', async () => {
        const fetchMock = jest.fn().mockResolvedValue(mockJsonResponse(404, { error: 'nf' }));
        global.fetch = fetchMock as unknown as typeof fetch;

        await expect(openaiCompatChat(BASE_REQ, PROFILE)).rejects.toBeDefined();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('11. does not retry on 500 (only 503 in the 5xx range is retryable)', async () => {
        const fetchMock = jest.fn().mockResolvedValue(mockJsonResponse(500, { error: 'oops' }));
        global.fetch = fetchMock as unknown as typeof fetch;

        await expect(openaiCompatChat(BASE_REQ, PROFILE)).rejects.toBeDefined();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});

describe('openaiCompat adapter — non-streaming response parsing', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    it('12. parses JSON and returns { content, reasoning, raw }', async () => {
        const raw = { choices: [{ message: { content: 'hello back' } }] };
        const fetchMock = jest.fn().mockResolvedValue(mockJsonResponse(200, raw));
        global.fetch = fetchMock as unknown as typeof fetch;

        const result = await openaiCompatChat(BASE_REQ, PROFILE);

        expect(result.content).toBe('hello back');
        expect(result.reasoning).toBe('');
        expect(result.raw).toEqual(raw);
    });

    it('13. extracts reasoning from reasoning_content (Kimi shape)', async () => {
        const raw = {
            choices: [
                {
                    message: {
                        content: 'final',
                        reasoning_content: 'thinking out loud',
                    },
                },
            ],
        };
        const fetchMock = jest.fn().mockResolvedValue(mockJsonResponse(200, raw));
        global.fetch = fetchMock as unknown as typeof fetch;

        const result = await openaiCompatChat(BASE_REQ, PROFILE);

        expect(result.content).toBe('final');
        expect(result.reasoning).toBe('thinking out loud');
    });

    it('14. falls back to reasoning field when reasoning_content is absent (OpenAI shape)', async () => {
        const raw = {
            choices: [
                {
                    message: {
                        content: 'final',
                        reasoning: 'internal thoughts',
                    },
                },
            ],
        };
        const fetchMock = jest.fn().mockResolvedValue(mockJsonResponse(200, raw));
        global.fetch = fetchMock as unknown as typeof fetch;

        const result = await openaiCompatChat(BASE_REQ, PROFILE);

        expect(result.reasoning).toBe('internal thoughts');
    });
});

describe('openaiCompat adapter — secret redaction & streaming pass-through', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    it('15. redacts the API key in any console.warn / console.error output', async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce(mockJsonResponse(429, { error: 'rate limit' }))
            .mockResolvedValueOnce(
                mockJsonResponse(200, { choices: [{ message: { content: 'ok' } }] })
            );
        global.fetch = fetchMock as unknown as typeof fetch;

        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await openaiCompatChat(BASE_REQ, PROFILE);

        const allCalls = [...warnSpy.mock.calls, ...errorSpy.mock.calls]
            .map((args) => args.map((a) => (typeof a === 'string' ? a : String(a))).join(' '))
            .join('\n');

        expect(allCalls).not.toContain(PROFILE.apiKey);
    });

    it('16. stream() returns the raw Response from fetch (no SSE parsing)', async () => {
        const sseBody = 'data: {"choices":[{"delta":{"content":"x"}}]}\n\ndata: [DONE]\n\n';
        const upstream = new Response(sseBody, {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
        });
        const fetchMock = jest.fn().mockResolvedValue(upstream);
        global.fetch = fetchMock as unknown as typeof fetch;

        const result = await openaiCompatStream({ ...BASE_REQ, stream: true }, PROFILE);

        expect(result).toBe(upstream);
        // Body is still consumable by the caller.
        const text = await result.text();
        expect(text).toBe(sseBody);
    });
});
