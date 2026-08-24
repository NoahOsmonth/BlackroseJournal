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
});
