import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useCustomAiModels } from '../../hooks/settings/useCustomAiModels';
import {
    getActiveCustomModelConfig,
    resetCustomModelStorageAdapter,
    setCustomModelStorageAdapter,
} from '../../services/ai/customModels';

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
    },
}));

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

    beforeEach(() => {
        setCustomModelStorageAdapter(createStorageAdapter());
        fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        resetCustomModelStorageAdapter();
        jest.restoreAllMocks();
    });

    it('fetches OpenAI-compatible models and saves the selected custom provider', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({
            data: [{ id: 'openai/gpt-4', name: 'GPT-4', context_length: 8192 }],
        }), { status: 200 }));

        const { result } = renderHook(() => useCustomAiModels());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => result.current.setBaseUrl('https://openrouter.ai'));
        act(() => result.current.setApiKey('sk-or-test'));
        await act(async () => result.current.fetchModels());
        await act(async () => result.current.saveSettings());

        expect(result.current.status).toEqual({
            kind: 'success',
            message: 'Custom model saved and enabled.',
        });
        await expect(getActiveCustomModelConfig()).resolves.toEqual(
            expect.objectContaining({
                apiBaseUrl: 'https://openrouter.ai/api/v1',
                model: 'openai/gpt-4',
                contextWindow: 8192,
            })
        );
    });

    it('enables the custom provider when a fetched model is selected', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({
            data: [
                { id: 'openai/gpt-4', name: 'GPT-4', context_length: 8192 },
                { id: 'anthropic/claude', name: 'Claude', context_length: 200000 },
            ],
        }), { status: 200 }));

        const { result } = renderHook(() => useCustomAiModels());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => result.current.setBaseUrl('https://openrouter.ai'));
        act(() => result.current.setApiKey('sk-or-test'));
        await act(async () => result.current.fetchModels());
        await act(async () => result.current.selectModel('anthropic/claude'));

        expect(result.current.settings.enabled).toBe(true);
        expect(result.current.settings.selectedModelId).toBe('anthropic/claude');
        expect(result.current.status).toEqual({
            kind: 'success',
            message: 'Custom model selected and enabled.',
        });
        await expect(getActiveCustomModelConfig()).resolves.toEqual(
            expect.objectContaining({ model: 'anthropic/claude' })
        );
    });
});
