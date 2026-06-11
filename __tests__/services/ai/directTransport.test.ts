/**
 * Tests for services/ai/directTransport.ts.
 *
 * Mocks `services/ai/directConfig` (the only direct dependency) so we
 * can pin the URL + key, then mocks the global `fetch` to verify the
 * wire shape (URL, headers, body, error path).
 */
import {
    fetchDirectChatCompletion,
    prepareDirectChatRequest,
} from '../../../services/ai/directTransport';
import { getResolvedDirectConfig } from '../../../services/ai/directConfig';

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
            .toThrow(/Could not connect to NanoGPT/);
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
