import {
    clearCustomAiProviderSettings,
    fetchOpenAiCompatibleModels,
    getActiveCustomModelConfig,
    getDefaultCustomAiProviderSettings,
    normalizeOpenAiBaseUrl,
    parseOpenAiCompatibleModels,
    resetCustomModelStorageAdapter,
    saveCustomAiProviderSettings,
    setCustomModelStorageAdapter,
} from '../../../services/ai/customModels';

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

describe('customModels service', () => {
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

    it('normalizes provider roots to OpenAI-compatible v1 bases', () => {
        expect(normalizeOpenAiBaseUrl('https://api.example.com'))
            .toBe('https://api.example.com/v1');
        expect(normalizeOpenAiBaseUrl('https://openrouter.ai'))
            .toBe('https://openrouter.ai/api/v1');
    });

    it('parses OpenAI model lists with fallback context metadata', () => {
        const models = parseOpenAiCompatibleModels({
            object: 'list',
            data: [{ id: 'gpt-example', object: 'model', owned_by: 'openai' }],
        }, 64_000);

        expect(models).toEqual([expect.objectContaining({
            id: 'gpt-example',
            ownedBy: 'openai',
            contextWindow: 64_000,
            contextWindowSource: 'fallback',
        })]);
    });

    it('parses OpenRouter context_length as API-detected context', () => {
        const models = parseOpenAiCompatibleModels({
            data: [{ id: 'openai/gpt-4', name: 'GPT-4', context_length: 8192 }],
        });

        expect(models[0]).toEqual(expect.objectContaining({
            id: 'openai/gpt-4',
            name: 'GPT-4',
            contextWindow: 8192,
            contextWindowSource: 'api',
        }));
    });

    it('fetches /models with bearer auth and returns parsed models', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({
            data: [{ id: 'openrouter/auto', context_length: 200_000 }],
        }), { status: 200 }));

        const result = await fetchOpenAiCompatibleModels({
            baseUrl: 'https://openrouter.ai',
            apiKey: 'sk-or-test',
        });

        expect(fetchMock).toHaveBeenCalledWith(
            'https://openrouter.ai/api/v1/models',
            expect.objectContaining({
                method: 'GET',
                headers: expect.objectContaining({ Authorization: 'Bearer sk-or-test' }),
            })
        );
        expect(result.models[0].contextWindow).toBe(200_000);
    });

    it('resolves the active selected custom model config', async () => {
        await saveCustomAiProviderSettings({
            ...getDefaultCustomAiProviderSettings(),
            enabled: true,
            baseUrl: 'https://openrouter.ai/api/v1',
            apiKey: 'sk-or-test',
            selectedModelId: 'openai/gpt-4',
            models: [{
                id: 'openai/gpt-4',
                contextWindow: 8192,
                contextWindowSource: 'api',
            }],
        });

        await expect(getActiveCustomModelConfig()).resolves.toEqual({
            apiBaseUrl: 'https://openrouter.ai/api/v1',
            apiKey: 'sk-or-test',
            model: 'openai/gpt-4',
            flashModel: 'openai/gpt-4',
            contextWindow: 8192,
            contextWindowSource: 'api',
        });
    });

    it('returns null when custom settings are cleared or disabled', async () => {
        await clearCustomAiProviderSettings();
        await expect(getActiveCustomModelConfig()).resolves.toBeNull();
    });
});
