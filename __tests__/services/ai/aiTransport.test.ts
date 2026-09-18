/* eslint-disable import/first */

jest.mock('../../../services/ai/directTransport', () => ({
    fetchDirectChatCompletion: jest.fn(),
    prepareDirectChatRequest: jest.fn(),
}));

import { activateAccount, clearActiveAccount } from '../../../services/account/accountRuntime';
import {
    fetchDirectChatCompletion,
    prepareDirectChatRequest,
} from '../../../services/ai/directTransport';
import {
    fetchAiChatCompletion,
    getAiTransportMode,
    prepareAiChatRequest,
} from '../../../services/ai/aiTransport';

const payload = { model: 'client-model', messages: [{ role: 'user', content: 'Hello' }], stream: false };

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
    return { promise, resolve };
}

describe('aiTransport mode boundary', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('always reports the direct transport (BYOK-only)', async () => {
        await expect(getAiTransportMode()).resolves.toBe('byok');
    });

    it('always uses the direct transport for chat completions', async () => {
        jest.mocked(fetchDirectChatCompletion).mockResolvedValue(new Response('{}'));

        await fetchAiChatCompletion(payload);

        expect(fetchDirectChatCompletion).toHaveBeenCalledWith(payload, undefined);
    });

    it('prepares XHR against the direct transport', async () => {
        jest.mocked(prepareDirectChatRequest).mockResolvedValue({ url: 'direct' } as never);

        await expect(prepareAiChatRequest(payload)).resolves.toEqual({
            mode: 'byok', request: { url: 'direct' },
        });
    });

    it('cancels an in-flight fetch when the account switches mid-request', async () => {
        await clearActiveAccount();
        await activateAccount('account-a');
        const release = deferred<void>();
        jest.mocked(fetchDirectChatCompletion).mockImplementation(async () => {
            await release.promise;
            return new Response('{}');
        });

        try {
            const pending = fetchAiChatCompletion({
                ...payload,
                messages: [{ role: 'user', content: 'private account A prompt' }],
            });
            await Promise.resolve();
            const switching = activateAccount('account-b');
            release.resolve();
            await switching;

            await expect(pending).rejects.toThrow('AI request was cancelled by an account switch.');
        } finally {
            await clearActiveAccount();
        }
    });
});
