/**
 * Tests for services/ai/directTransport.ts.
 *
 * Mocks `services/ai/directConfig` (the only direct dependency) so we
 * can pin the URL + key, then mocks the global `fetch` to verify the
 * wire shape (URL, headers, body, error path).
 */
import { loadCustomAiProviderSettings } from '../../../services/ai/customModels';
import { getResolvedDirectConfig } from '../../../services/ai/directConfig';
import {
    clearModelUnavailableCache,
    fetchDirectChatCompletion,
    getLastResolvedModel,
    isModelCachedUnavailable,
    prepareDirectChatRequest,
} from '../../../services/ai/directTransport';

const TEST_ENV_RESOLVED_CONFIG = {
    apiKey: 'sk-direct-test-key',
    apiBaseUrl: 'https://nano-gpt.com/api/v1',
    model: 'moonshotai/kimi-k2.5:thinking',
    flashModel: 'moonshotai/kimi-k2.5',
    source: 'env',
} as const;

jest.mock('../../../services/ai/directConfig', () => ({
    getDirectConfig: () => ({
        apiKey: 'sk-direct-test-key',
        apiBaseUrl: 'https://nano-gpt.com/api/v1',
        model: 'moonshotai/kimi-k2.5:thinking',
        flashModel: 'moonshotai/kimi-k2.5',
    }),
    getResolvedDirectConfig: jest.fn(() => Promise.resolve({
        apiKey: 'sk-direct-test-key',
        apiBaseUrl: 'https://nano-gpt.com/api/v1',
        model: 'moonshotai/kimi-k2.5:thinking',
        flashModel: 'moonshotai/kimi-k2.5',
        source: 'env',
    })),
}));

jest.mock('../../../services/ai/customModels', () => {
    const actual = jest.requireActual('../../../services/ai/customModels') as typeof import('../../../services/ai/customModels');
    return {
        ...actual,
        loadCustomAiProviderSettings: jest.fn(() => Promise.resolve({
            enabled: false,
            baseUrl: 'https://openrouter.ai/api/v1',
            apiKey: '',
            selectedModelId: null,
            models: [
                {
                    id: 'meta/llama-70b-instruct:free',
                    contextWindow: 128_000,
                    contextWindowSource: 'known' as const,
                },
                {
                    id: 'org/tiny-3b:free',
                    contextWindow: 8_000,
                    contextWindowSource: 'fallback' as const,
                },
            ],
            freeOnly: true,
            recentModelIds: [],
            fallbackContextWindow: 128_000,
            updatedAt: 0,
        })),
    };
});

const BASE_PAYLOAD = {
    model: 'moonshotai/kimi-k2.5:thinking',
    messages: [{ role: 'user', content: 'Hello' }],
    stream: false,
};

describe('directTransport — fetchDirectChatCompletion', () => {
    const originalFetch = global.fetch;
    let fetchMock: jest.Mock;

    beforeEach(() => {
        fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
        jest.mocked(getResolvedDirectConfig).mockResolvedValue(TEST_ENV_RESOLVED_CONFIG);
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    it('1. builds the URL as ${apiBaseUrl}/chat/completions', async () => {
        fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));

        await fetchDirectChatCompletion(BASE_PAYLOAD);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('https://nano-gpt.com/api/v1/chat/completions');
    });

    it('2. sets Authorization: Bearer ${apiKey}', async () => {
        fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));

        await fetchDirectChatCompletion(BASE_PAYLOAD);

        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const headers = init.headers as Record<string, string>;
        expect(headers.Authorization).toBe('Bearer sk-direct-test-key');
    });

    it('3. throws the friendly error on fetch reject', async () => {
        fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

        await expect(fetchDirectChatCompletion(BASE_PAYLOAD))
            .rejects
            .toThrow(/Could not connect to AI provider/);
        await expect(fetchDirectChatCompletion(BASE_PAYLOAD))
            .rejects
            .toThrow('https://nano-gpt.com/api/v1/chat/completions');
        await expect(fetchDirectChatCompletion(BASE_PAYLOAD))
            .rejects
            .toThrow(/EXPO_PUBLIC_NANO_GPT_API_BASE_URL/);
    });

    it('4. sends Content-Type: application/json and stringifies the body', async () => {
        fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));

        await fetchDirectChatCompletion(BASE_PAYLOAD);

        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const headers = init.headers as Record<string, string>;
        expect(headers['Content-Type']).toBe('application/json');
        expect(headers.Accept).toBe('application/json');
        expect(typeof init.body).toBe('string');
        expect(JSON.parse(String(init.body))).toEqual(BASE_PAYLOAD);
    });

    it('5. maps agent-default to the configured direct model', async () => {
        const request = await prepareDirectChatRequest({
            ...BASE_PAYLOAD,
            model: 'agent-default',
        });

        expect(request.body.model).toBe('moonshotai/kimi-k2.5:thinking');
    });

    it('6. strips backend-only fields from the outbound body', async () => {
        const request = await prepareDirectChatRequest({
            ...BASE_PAYLOAD,
            conversationId: 'local-chat',
        } as typeof BASE_PAYLOAD & { conversationId: string });

        expect(request.body).not.toHaveProperty('conversationId');
        expect(request.body).not.toHaveProperty('max_context');
    });

    it('7. maps agent-default to the flash model for flash-purpose helpers', async () => {
        const request = await prepareDirectChatRequest({
            ...BASE_PAYLOAD,
            model: 'agent-default',
        }, { modelPurpose: 'flash' });

        expect(request.body.model).toBe('moonshotai/kimi-k2.5');
    });

    it('8. asks for event-stream responses when streaming', async () => {
        const request = await prepareDirectChatRequest({
            ...BASE_PAYLOAD,
            stream: true,
        });

        expect(request.headers.Accept).toBe('text/event-stream');
    });

    it('9. forwards top_p in the OpenAI-compatible request body', async () => {
        const request = await prepareDirectChatRequest({
            ...BASE_PAYLOAD,
            temperature: 0.4,
            top_p: 0.65,
            max_tokens: 2048,
        });

        expect(request.body).toMatchObject({
            temperature: 0.4,
            top_p: 0.65,
            max_tokens: 2048,
        });
    });

    it('10. always uses the selected custom provider model when custom config is enabled', async () => {
        jest.mocked(getResolvedDirectConfig).mockResolvedValue({
            apiKey: 'sk-custom-test-key',
            apiBaseUrl: 'https://openrouter.ai/api/v1',
            model: 'openai/gpt-4o',
            flashModel: 'openai/gpt-4o',
            source: 'custom',
            contextWindow: 128000,
            contextWindowSource: 'fallback',
        });

        const request = await prepareDirectChatRequest({
            ...BASE_PAYLOAD,
            model: 'moonshotai/kimi-k2.5:thinking',
        });

        expect(request.url).toBe('https://openrouter.ai/api/v1/chat/completions');
        expect(request.headers.Authorization).toBe('Bearer sk-custom-test-key');
        expect(request.body.model).toBe('openai/gpt-4o');
    });
});

describe('directTransport — provider-specific (ZenMux)', () => {
    const originalFetch = global.fetch;
    let fetchMock: jest.Mock;

    beforeEach(() => {
        fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
        jest.mocked(getResolvedDirectConfig).mockResolvedValue({
            apiKey: 'sk-zenmux',
            apiBaseUrl: 'https://zenmux.ai/api/v1',
            model: 'stepfun/step-3.7-flash-free',
            flashModel: 'stepfun/step-3.7-flash-free',
            source: 'env',
        });
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    it('uses max_completion_tokens instead of max_tokens for ZenMux', async () => {
        fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));

        await fetchDirectChatCompletion({ ...BASE_PAYLOAD, max_tokens: 512 });

        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        expect(body.max_completion_tokens).toBe(512);
        expect(body).not.toHaveProperty('max_tokens');
    });

    it('omits the token field entirely when no max_tokens is requested', async () => {
        fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));

        await fetchDirectChatCompletion(BASE_PAYLOAD);

        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        expect(body).not.toHaveProperty('max_tokens');
        expect(body).not.toHaveProperty('max_completion_tokens');
    });

    it('retries transient network failures before surfacing the connection error', async () => {
        fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

        await expect(fetchDirectChatCompletion(BASE_PAYLOAD)).rejects.toThrow(/Could not connect/);
        // 3 same-model attempts (self-heal)
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });
});

describe('directTransport — self-heal retries + model cascade', () => {
    const originalFetch = global.fetch;
    let fetchMock: jest.Mock;

    beforeEach(() => {
        fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
        jest.mocked(getResolvedDirectConfig).mockResolvedValue({
            apiKey: 'sk-or',
            apiBaseUrl: 'https://openrouter.ai/api/v1',
            model: 'dead/missing-7b:free',
            flashModel: 'dead/missing-7b:free',
            source: 'env',
        });
        jest.mocked(loadCustomAiProviderSettings).mockResolvedValue({
            enabled: false,
            baseUrl: 'https://openrouter.ai/api/v1',
            apiKey: '',
            selectedModelId: null,
            models: [
                {
                    id: 'meta/llama-70b-instruct:free',
                    contextWindow: 128_000,
                    contextWindowSource: 'known',
                },
                {
                    id: 'org/tiny-3b:free',
                    contextWindow: 8_000,
                    contextWindowSource: 'fallback',
                },
            ],
            freeOnly: true,
            recentModelIds: [],
            fallbackContextWindow: 128_000,
            updatedAt: 0,
        });
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    it('retries 504 three times on the same model before giving up', async () => {
        fetchMock.mockResolvedValue(
            new Response(JSON.stringify({ error: 'gateway timeout' }), { status: 504 })
        );

        const response = await fetchDirectChatCompletion({
            model: 'dead/missing-7b:free',
            messages: [{ role: 'user', content: 'hi' }],
            stream: false,
        });

        expect(response.status).toBe(504);
        expect(fetchMock).toHaveBeenCalledTimes(3);
        for (const call of fetchMock.mock.calls) {
            const body = JSON.parse(String((call[1] as RequestInit).body)) as { model: string };
            expect(body.model).toBe('dead/missing-7b:free');
        }
    });

    it('cascades to a higher-parameter free model when the primary is missing', async () => {
        fetchMock
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({ error: { message: 'No endpoints found for dead/missing-7b:free' } }),
                    { status: 404 }
                )
            )
            .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [] }), { status: 200 }));

        const response = await fetchDirectChatCompletion({
            model: 'dead/missing-7b:free',
            messages: [{ role: 'user', content: 'hi' }],
            stream: false,
        });

        expect(response.ok).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const secondBody = JSON.parse(
            String((fetchMock.mock.calls[1][1] as RequestInit).body)
        ) as { model: string };
        // Highest-parameter free alternate first (builtin 550b > cached 70b)
        expect(secondBody.model).toBe('nvidia/nemotron-3-ultra-550b-a55b:free');
    });

    it('does not retry non-retryable 401 auth failures', async () => {
        fetchMock.mockResolvedValue(
            new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
        );

        const response = await fetchDirectChatCompletion({
            model: 'dead/missing-7b:free',
            messages: [{ role: 'user', content: 'hi' }],
            stream: false,
        });

        expect(response.status).toBe(401);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});

describe('directTransport — model unavailability cache (Fix 1)', () => {
    const originalFetch = global.fetch;
    let fetchMock: jest.Mock;

    beforeEach(() => {
        clearModelUnavailableCache();
        fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
        jest.mocked(getResolvedDirectConfig).mockResolvedValue({
            apiKey: 'sk-or',
            apiBaseUrl: 'https://openrouter.ai/api/v1',
            model: 'dead/missing-7b:free',
            flashModel: 'dead/missing-7b:free',
            source: 'env',
        });
        jest.mocked(loadCustomAiProviderSettings).mockResolvedValue({
            enabled: false,
            baseUrl: 'https://openrouter.ai/api/v1',
            apiKey: '',
            selectedModelId: null,
            models: [
                {
                    id: 'meta/llama-70b-instruct:free',
                    contextWindow: 128_000,
                    contextWindowSource: 'known',
                },
            ],
            freeOnly: true,
            recentModelIds: [],
            fallbackContextWindow: 128_000,
            updatedAt: 0,
        });
    });

    afterEach(() => {
        global.fetch = originalFetch;
        clearModelUnavailableCache();
        jest.restoreAllMocks();
    });

    it('caches model as unavailable after 404 and skips it on next request', async () => {
        // First request: 404 on primary, 200 on fallback
        fetchMock
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({ error: { message: 'No endpoints found' } }),
                    { status: 404 }
                )
            )
            .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [] }), { status: 200 }));

        await fetchDirectChatCompletion({
            model: 'dead/missing-7b:free',
            messages: [{ role: 'user', content: 'hi' }],
            stream: false,
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);

        // Model is now cached as unavailable
        expect(isModelCachedUnavailable('dead/missing-7b:free')).toBe(true);

        // Second request: should skip primary entirely, go straight to fallback
        fetchMock.mockResolvedValueOnce(
            new Response(JSON.stringify({ choices: [] }), { status: 200 })
        );

        await fetchDirectChatCompletion({
            model: 'dead/missing-7b:free',
            messages: [{ role: 'user', content: 'hi again' }],
            stream: false,
        });

        // Only 1 fetch call (the fallback) — primary was skipped
        expect(fetchMock).toHaveBeenCalledTimes(3);
        const lastBody = JSON.parse(
            String((fetchMock.mock.calls[2][1] as RequestInit).body)
        ) as { model: string };
        expect(lastBody.model).not.toBe('dead/missing-7b:free');
    });

    it('clearModelUnavailableCache resets the cache', async () => {
        fetchMock
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({ error: { message: 'No endpoints found' } }),
                    { status: 404 }
                )
            )
            .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [] }), { status: 200 }));

        await fetchDirectChatCompletion({
            model: 'dead/missing-7b:free',
            messages: [{ role: 'user', content: 'hi' }],
            stream: false,
        });

        expect(isModelCachedUnavailable('dead/missing-7b:free')).toBe(true);
        clearModelUnavailableCache();
        expect(isModelCachedUnavailable('dead/missing-7b:free')).toBe(false);
    });

    it('isModelCachedUnavailable returns false for agent-default and null', () => {
        expect(isModelCachedUnavailable('agent-default')).toBe(false);
        expect(isModelCachedUnavailable(null)).toBe(false);
        expect(isModelCachedUnavailable(undefined)).toBe(false);
    });
});

describe('directTransport — getLastResolvedModel (Fix 2)', () => {
    const originalFetch = global.fetch;
    let fetchMock: jest.Mock;

    beforeEach(() => {
        clearModelUnavailableCache();
        fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
        jest.mocked(getResolvedDirectConfig).mockResolvedValue({
            apiKey: 'sk-or',
            apiBaseUrl: 'https://openrouter.ai/api/v1',
            model: 'dead/missing-7b:free',
            flashModel: 'dead/missing-7b:free',
            source: 'env',
        });
        jest.mocked(loadCustomAiProviderSettings).mockResolvedValue({
            enabled: false,
            baseUrl: 'https://openrouter.ai/api/v1',
            apiKey: '',
            selectedModelId: null,
            models: [],
            freeOnly: true,
            recentModelIds: [],
            fallbackContextWindow: 128_000,
            updatedAt: 0,
        });
    });

    afterEach(() => {
        global.fetch = originalFetch;
        clearModelUnavailableCache();
        jest.restoreAllMocks();
    });

    it('tracks the model that actually served the request after self-heal', async () => {
        fetchMock
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({ error: { message: 'No endpoints found' } }),
                    { status: 404 }
                )
            )
            .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [] }), { status: 200 }));

        await fetchDirectChatCompletion({
            model: 'dead/missing-7b:free',
            messages: [{ role: 'user', content: 'hi' }],
            stream: false,
        });

        // The resolved model should be the fallback, not the dead primary
        const resolved = getLastResolvedModel();
        expect(resolved).not.toBe('dead/missing-7b:free');
        expect(resolved).toBeTruthy();
    });
});
