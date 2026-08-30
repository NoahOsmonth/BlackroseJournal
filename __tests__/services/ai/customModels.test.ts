import {
    assertModelAllowed,
    buildManualModel,
    clearCustomAiProviderSettings,
    fetchOpenAiCompatibleModels,
    getActiveCustomModelConfig,
    getDefaultCustomAiProviderSettings,
    normalizeOpenAiBaseUrl,
    parseOpenAiCompatibleModels,
    resetCustomModelStorageAdapter,
    saveCustomAiProviderSettings,
    setCustomModelStorageAdapter,
    withManualModel,
    withSelectedModel,
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

    it('defaults freeOnly off and the OmniRoute gateway base', () => {
        const defaults = getDefaultCustomAiProviderSettings();
        expect(defaults.freeOnly).toBe(false);
        expect(defaults.baseUrl).toBe('http://100.107.7.52:20128/v1');
        expect(defaults.recentModelIds).toEqual([]);
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

    it('fetches /models with bearer auth and returns all models by default', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({
            data: [
                { id: 'openai/gpt-4', context_length: 8192 },
                { id: 'tencent/hy3:free', context_length: 262000 },
            ],
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
        expect(result.models).toHaveLength(2);
        expect(result.models.map((m) => m.id)).toEqual(['openai/gpt-4', 'tencent/hy3:free']);
        expect(result.models[1].contextWindow).toBe(262000);
    });

    it('filters to free models only when freeOnly is true', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({
            data: [
                { id: 'openai/gpt-4', context_length: 8192 },
                { id: 'tencent/hy3:free', context_length: 262000 },
            ],
        }), { status: 200 }));

        const result = await fetchOpenAiCompatibleModels({
            baseUrl: 'https://openrouter.ai',
            apiKey: 'sk-or-test',
            freeOnly: true,
        });
        expect(result.models).toHaveLength(1);
        expect(result.models[0].id).toBe('tencent/hy3:free');
    });

    it('can fetch all models when freeOnly is false', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({
            data: [
                { id: 'openai/gpt-4', context_length: 8192 },
                { id: 'tencent/hy3:free', context_length: 262000 },
            ],
        }), { status: 200 }));

        const result = await fetchOpenAiCompatibleModels({
            baseUrl: 'https://openrouter.ai/api/v1',
            apiKey: 'sk-or-test',
            freeOnly: false,
        });
        expect(result.models).toHaveLength(2);
    });

    it('blocks paid models when freeOnly is on', () => {
        expect(() => assertModelAllowed('openai/gpt-4', true)).toThrow(/Free models only/);
        expect(() => assertModelAllowed('tencent/hy3:free', true)).not.toThrow();
    });

    it('withSelectedModel records recent ids and rejects paid free-only picks', () => {
        const base = {
            ...getDefaultCustomAiProviderSettings(),
            freeOnly: true,
            models: [
                {
                    id: 'tencent/hy3:free',
                    contextWindow: 262000,
                    contextWindowSource: 'api' as const,
                },
            ],
        };
        const next = withSelectedModel(base, 'tencent/hy3:free');
        expect(next.selectedModelId).toBe('tencent/hy3:free');
        expect(next.recentModelIds).toEqual(['tencent/hy3:free']);
        expect(next.enabled).toBe(true);
        expect(() => withSelectedModel(base, 'openai/gpt-4')).toThrow(/Free models only/);
    });

    it('buildManualModel normalizes id and applies fallback context', () => {
        const model = buildManualModel('  qwen-web/qwen3.8-max  ', 128_000);
        expect(model.id).toBe('qwen-web/qwen3.8-max');
        expect(model.contextWindow).toBe(128_000);
        expect(model.contextWindowSource).toBe('fallback');
        expect(() => buildManualModel('   ', 128_000)).toThrow(/Model id is required/);
    });

    it('withManualModel adds, selects, and enables a free web model', () => {
        const base = getDefaultCustomAiProviderSettings();
        const next = withManualModel(base, 'qwen-web/qwen3.8-max', 128_000);
        expect(next.models).toHaveLength(1);
        expect(next.models[0].id).toBe('qwen-web/qwen3.8-max');
        expect(next.selectedModelId).toBe('qwen-web/qwen3.8-max');
        expect(next.enabled).toBe(true);
        expect(next.recentModelIds).toEqual(['qwen-web/qwen3.8-max']);
    });

    it('withManualModel dedupes on id without duplicating entries', () => {
        const base = {
            ...getDefaultCustomAiProviderSettings(),
            models: [{ id: 'qwen-web/qwen3.8-max', contextWindow: 64_000, contextWindowSource: 'fallback' as const }],
        };
        const next = withManualModel(base, 'qwen-web/qwen3.8-max', 128_000);
        expect(next.models).toHaveLength(1);
        expect(next.models[0].contextWindow).toBe(128_000);
    });

    it('withManualModel blocks paid ids while freeOnly is on', () => {
        expect(() => withManualModel(
            { ...getDefaultCustomAiProviderSettings(), freeOnly: true },
            'cl/qwen/qwen3.8-max',
            128_000
        )).toThrow(/Free models only/);
    });

    it('resolves the active selected free custom model config', async () => {
        await saveCustomAiProviderSettings({
            ...getDefaultCustomAiProviderSettings(),
            enabled: true,
            freeOnly: true,
            baseUrl: 'https://openrouter.ai/api/v1',
            apiKey: 'sk-or-test',
            selectedModelId: 'tencent/hy3:free',
            models: [{
                id: 'tencent/hy3:free',
                contextWindow: 262000,
                contextWindowSource: 'api',
            }],
        });

        await expect(getActiveCustomModelConfig()).resolves.toEqual({
            apiBaseUrl: 'https://openrouter.ai/api/v1',
            apiKey: 'sk-or-test',
            model: 'tencent/hy3:free',
            flashModel: 'tencent/hy3:free',
            contextWindow: 262000,
            contextWindowSource: 'api',
        });
    });

    it('returns null when custom settings are cleared or disabled', async () => {
        await clearCustomAiProviderSettings();
        await expect(getActiveCustomModelConfig()).resolves.toBeNull();
    });
});
