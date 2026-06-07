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

jest.mock('../../../services/ai/directConfig', () => ({
    getDirectConfig: () => ({
        apiKey: 'sk-direct-test-key',
        apiBaseUrl: 'https://nano-gpt.com/api/v1',
        model: 'moonshotai/kimi-k2.5:thinking',
        flashModel: 'moonshotai/kimi-k2.5',
    }),
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
        expect(typeof init.body).toBe('string');
        expect(JSON.parse(String(init.body))).toEqual(BASE_PAYLOAD);
    });

    it('5. maps agent-default to the configured direct model', () => {
        const request = prepareDirectChatRequest({
            ...BASE_PAYLOAD,
            model: 'agent-default',
        });

        expect(request.body.model).toBe('moonshotai/kimi-k2.5:thinking');
    });

    it('6. strips backend-only fields from the outbound body', () => {
        const request = prepareDirectChatRequest({
            ...BASE_PAYLOAD,
            conversationId: 'local-chat',
        } as typeof BASE_PAYLOAD & { conversationId: string });

        expect(request.body).not.toHaveProperty('conversationId');
        expect(request.body).not.toHaveProperty('max_context');
    });
});
