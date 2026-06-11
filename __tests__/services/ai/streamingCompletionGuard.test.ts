import { completeChat, Message, streamChat } from '../../../services/ai';

jest.mock('../../../services/ai/directConfig', () => ({
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

const messages: Message[] = [{
    id: '1',
    role: 'user',
    content: 'hello',
    timestamp: Date.now(),
}];

describe('AI streaming completion guards', () => {
    const originalFetch = global.fetch;
    const originalXhr = global.XMLHttpRequest;
    let fetchMock: jest.Mock;

    beforeEach(() => {
        fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        (global as unknown as { XMLHttpRequest: typeof originalXhr }).XMLHttpRequest = originalXhr;
        jest.restoreAllMocks();
    });

    it('falls back to fetch parsing when xhr ends without final content', async () => {
        class MockXmlHttpRequest {
            onreadystatechange: (() => void) | null = null;
            onload: (() => void) | null = null;
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
                this.responseText = 'data: [DONE]\n\n';
                this.readyState = 4;
                this.onreadystatechange?.();
                this.onload?.();
            }
        }

        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        (global as unknown as { XMLHttpRequest: typeof MockXmlHttpRequest }).XMLHttpRequest = MockXmlHttpRequest;
        fetchMock.mockResolvedValue(new Response(JSON.stringify({
            choices: [{ message: { content: 'fetch fallback', reasoning: '' } }],
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));

        const onComplete = jest.fn();
        const onError = jest.fn();

        await streamChat(messages, jest.fn(), onComplete, onError);

        expect(onError).not.toHaveBeenCalled();
        expect(onComplete).toHaveBeenCalledWith('fetch fallback', '');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('rejects reasoning-only completions instead of saving blank AI replies', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({
            choices: [{ message: { content: '', reasoning: 'still thinking' } }],
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));

        await expect(completeChat(messages, 'system prompt'))
            .rejects
            .toThrow(/reasoning without a final answer/);
    });
});
