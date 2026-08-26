/* eslint-disable import/first */

jest.mock('../../../services/ai/customModels', () => ({
    loadCustomAiProviderSettings: jest.fn(),
}));
jest.mock('../../../services/ai/directTransport', () => ({
    fetchDirectChatCompletion: jest.fn(),
    prepareDirectChatRequest: jest.fn(),
}));
jest.mock('../../../services/ai/managedTransport', () => ({
    fetchManagedChatCompletion: jest.fn(),
    prepareManagedChatRequest: jest.fn(),
}));

import { loadCustomAiProviderSettings } from '../../../services/ai/customModels';
import { activateAccount, clearActiveAccount } from '../../../services/account/accountRuntime';
import {
    fetchDirectChatCompletion,
    prepareDirectChatRequest,
} from '../../../services/ai/directTransport';
import {
    fetchManagedChatCompletion,
    prepareManagedChatRequest,
} from '../../../services/ai/managedTransport';
import { fetchAiChatCompletion, prepareAiChatRequest } from '../../../services/ai/aiTransport';

const payload = { model: 'client-model', messages: [{ role: 'user', content: 'Hello' }], stream: false };

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
    return { promise, resolve };
}

describe('aiTransport mode boundary', () => {
    beforeEach(() => jest.clearAllMocks());

    it('uses only the managed gateway while BYOK is off', async () => {
        jest.mocked(loadCustomAiProviderSettings).mockResolvedValue({ enabled: false } as never);
        jest.mocked(fetchManagedChatCompletion).mockResolvedValue(new Response('{}'));

        await fetchAiChatCompletion(payload);

        expect(fetchManagedChatCompletion).toHaveBeenCalledWith(payload, undefined);
        expect(fetchDirectChatCompletion).not.toHaveBeenCalled();
    });

    it('uses only the direct custom provider while BYOK is on', async () => {
        jest.mocked(loadCustomAiProviderSettings).mockResolvedValue({ enabled: true } as never);
        jest.mocked(fetchDirectChatCompletion).mockResolvedValue(new Response('{}'));

        await fetchAiChatCompletion(payload);

        expect(fetchDirectChatCompletion).toHaveBeenCalledWith(payload, undefined);
        expect(fetchManagedChatCompletion).not.toHaveBeenCalled();
    });

    it('prepares XHR against the selected mode without crossing transports', async () => {
        jest.mocked(loadCustomAiProviderSettings).mockResolvedValue({ enabled: false } as never);
        jest.mocked(prepareManagedChatRequest).mockResolvedValue({ url: 'managed' } as never);

        await expect(prepareAiChatRequest(payload)).resolves.toEqual({
            mode: 'managed', request: { url: 'managed' },
        });
        expect(prepareDirectChatRequest).not.toHaveBeenCalled();
    });

    it('does not route an account A prompt after mode resolution is interrupted by a switch to B', async () => {
        await clearActiveAccount();
        await activateAccount('account-a');
        const modeReadStarted = deferred<void>();
        const settings = deferred<{ enabled: boolean }>();
        jest.mocked(loadCustomAiProviderSettings).mockImplementation(() => {
            modeReadStarted.resolve();
            return settings.promise as never;
        });

        try {
            const pending = fetchAiChatCompletion({
                ...payload,
                messages: [{ role: 'user', content: 'private account A prompt' }],
            });
            await modeReadStarted.promise;
            const switching = activateAccount('account-b');
            settings.resolve({ enabled: true });
            await switching;

            await expect(pending).rejects.toThrow('AI request was cancelled by an account switch.');
            expect(fetchDirectChatCompletion).not.toHaveBeenCalled();
            expect(fetchManagedChatCompletion).not.toHaveBeenCalled();
        } finally {
            await clearActiveAccount();
        }
    });
});
