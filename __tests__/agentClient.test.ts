import { postAgent } from '../services/agent/agentClient';

// Mock getAgentConfig to return a known URL
jest.mock('../services/agent/agentConfig', () => ({
    getAgentConfig: () => ({
        apiBaseUrl: 'http://localhost:9999',
        apiKey: 'test-key',
    }),
}));

describe('agentClient', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('throws a descriptive error on network failure', async () => {
        global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));

        await expect(postAgent('/v1/chat/completions', { prompt: 'hi' }))
            .rejects
            .toThrow('Could not connect to AI backend');
    });

    it('includes the URL in the network error message', async () => {
        global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));

        await expect(postAgent('/v1/chat/completions', {}))
            .rejects
            .toThrow('http://localhost:9999/v1/chat/completions');
    });

    it('returns response on successful fetch', async () => {
        const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
        global.fetch = jest.fn().mockResolvedValue(mockResponse);

        const result = await postAgent('/v1/test', { data: 1 });
        expect(result.ok).toBe(true);
    });

    it('sends Authorization header when apiKey is present', async () => {
        const mockResponse = new Response('{}', { status: 200 });
        global.fetch = jest.fn().mockResolvedValue(mockResponse);

        await postAgent('/v1/test', {});

        expect(global.fetch).toHaveBeenCalledWith(
            'http://localhost:9999/v1/test',
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer test-key',
                }),
            })
        );
    });
});
