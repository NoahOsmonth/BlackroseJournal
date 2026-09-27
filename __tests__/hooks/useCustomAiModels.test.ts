import { act, renderHook, waitFor } from '@testing-library/react-native';

import { parseFilterPatterns, useCustomAiModels } from '../../hooks/settings/useCustomAiModels';
import {
    getActiveCustomModelConfig,
    resetCustomModelStorageAdapter,
    setCustomModelStorageAdapter,
} from '../../services/ai/customModels';
import { activateAccount, clearActiveAccount } from '../../services/account/accountRuntime';

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
    },
}));

const HOST = 'https://api.example.com';

const CATALOGUE = {
    data: [
        { id: 'openai/gpt-4', name: 'GPT-4', context_length: 8192 },
        { id: 'tencent/hy3:free', name: 'Hy3 free', context_length: 262000 },
    ],
};

function createStorageAdapter() {
    const store = new Map<string, string>();
    return {
        getItem: (key: string) => Promise.resolve(store.get(key) ?? null),
        setItem: (key: string, value: string) => {
            store.set(key, value);
            return Promise.resolve();
        },
        removeItem: (key: string) => {
            store.delete(key);
            return Promise.resolve();
        },
    };
}

describe('useCustomAiModels', () => {
    const originalFetch = global.fetch;
    let fetchMock: jest.Mock;

    beforeEach(async () => {
        await activateAccount('account-use-custom-ai');
        setCustomModelStorageAdapter(createStorageAdapter());
        fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    afterEach(async () => {
        global.fetch = originalFetch;
        resetCustomModelStorageAdapter();
        jest.restoreAllMocks();
        await clearActiveAccount();
    });

    function mockCatalogue(payload: unknown = CATALOGUE) {
        fetchMock.mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    }

    async function renderLoaded() {
        const rendered = renderHook(() => useCustomAiModels());
        await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
        return rendered;
    }

    it('parses comma and newline separated filter patterns', () => {
        expect(parseFilterPatterns(':free, qwen-web/\n\n  ds-web/  '))
            .toEqual([':free', 'qwen-web/', 'ds-web/']);
        expect(parseFilterPatterns('   ')).toEqual([]);
    });

    it('fetches the endpoint catalogue and saves the provider', async () => {
        mockCatalogue();
        const { result } = await renderLoaded();

        act(() => result.current.setBaseUrl(HOST));
        act(() => result.current.setApiKey('test-key'));
        await act(async () => { await result.current.fetchModels(); });
        await act(async () => { await result.current.saveSettings(); });

        expect(result.current.status).toEqual({ kind: 'success', message: 'Provider saved.' });
        expect(result.current.profile?.models.map((m) => m.id))
            .toEqual(['openai/gpt-4', 'tencent/hy3:free']);
        // The base URL is normalized to the OpenAI-compatible form.
        expect(result.current.profile?.baseUrl).toBe(`${HOST}/v1`);
    });

    it('enables the provider when a model is selected', async () => {
        mockCatalogue();
        const { result } = await renderLoaded();

        act(() => result.current.setBaseUrl(HOST));
        act(() => result.current.setApiKey('test-key'));
        await act(async () => { await result.current.fetchModels(); });
        await act(async () => { await result.current.selectModel('tencent/hy3:free'); });

        expect(result.current.settings.enabled).toBe(true);
        expect(result.current.profile?.selectedModelId).toBe('tencent/hy3:free');
        expect(result.current.profile?.recentModelIds[0]).toBe('tencent/hy3:free');
        expect(result.current.status).toEqual({ kind: 'success', message: 'Model selected.' });
        await expect(getActiveCustomModelConfig()).resolves.toEqual(
            expect.objectContaining({
                apiBaseUrl: `${HOST}/v1`,
                model: 'tencent/hy3:free',
                contextWindow: 262000,
            })
        );
    });

    it('narrows the catalogue with the user filter patterns', async () => {
        mockCatalogue();
        const { result } = await renderLoaded();

        act(() => result.current.setBaseUrl(HOST));
        act(() => result.current.setApiKey('test-key'));
        act(() => result.current.setModelFilterPatterns(':free'));
        await act(async () => { await result.current.fetchModels(); });

        expect(result.current.profile?.models.map((m) => m.id)).toEqual(['tencent/hy3:free']);
        expect(result.current.profile?.modelFilterPatterns).toEqual([':free']);
    });

    it('rejects selecting a model that is not in the catalogue', async () => {
        mockCatalogue();
        const { result } = await renderLoaded();

        act(() => result.current.setBaseUrl(HOST));
        act(() => result.current.setApiKey('test-key'));
        await act(async () => { await result.current.fetchModels(); });
        await act(async () => { await result.current.selectModel('openai/not-served'); });

        expect(result.current.status.kind).toBe('error');
        expect(result.current.profile?.selectedModelId).not.toBe('openai/not-served');
    });

    it('surfaces a fetch failure without wiping the saved profile', async () => {
        mockCatalogue();
        const { result } = await renderLoaded();

        act(() => result.current.setBaseUrl(HOST));
        act(() => result.current.setApiKey('test-key'));
        await act(async () => { await result.current.fetchModels(); });

        fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));
        await act(async () => { await result.current.fetchModels(); });

        expect(result.current.status.kind).toBe('error');
        expect(result.current.profile?.models.map((m) => m.id))
            .toEqual(['openai/gpt-4', 'tencent/hy3:free']);
    });

    it('adds a hand-typed model id and enables it', async () => {
        const { result } = await renderLoaded();

        await act(async () => { await result.current.addManualModel('qwen-web/qwen3.8-max'); });

        expect(result.current.profile?.models.map((m) => m.id)).toEqual(['qwen-web/qwen3.8-max']);
        expect(result.current.profile?.selectedModelId).toBe('qwen-web/qwen3.8-max');
        expect(result.current.settings.enabled).toBe(true);
        expect(result.current.status).toEqual({
            kind: 'success',
            message: 'Added qwen-web/qwen3.8-max.',
        });
    });

    it('adds a second provider and removes it again', async () => {
        const { result } = await renderLoaded();
        expect(result.current.settings.profiles).toHaveLength(1);

        await act(async () => { await result.current.addProfile(); });
        expect(result.current.settings.profiles).toHaveLength(2);
        expect(result.current.status.message).toBe('New provider added. Enter its details.');

        await act(async () => { await result.current.removeActiveProfile(); });
        expect(result.current.settings.profiles).toHaveLength(1);
        expect(result.current.status.message).toBe('Provider removed.');
    });

    it('refuses to enable a provider with no model selected', async () => {
        const { result } = await renderLoaded();

        await act(async () => { await result.current.setEnabled(true); });

        expect(result.current.status).toEqual({
            kind: 'error',
            message: 'Fetch and select a model first.',
        });
        expect(result.current.settings.enabled).toBe(false);
    });
});
