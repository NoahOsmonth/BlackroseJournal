import {
    CUSTOM_AI_SETTINGS_KEY,
    MAX_PROVIDER_PROFILES,
    PROVIDER_SETTINGS_SCHEMA_VERSION,
    addProviderProfile,
    buildManualModel,
    clearCustomAiProviderSettings,
    createProviderProfile,
    fetchOpenAiCompatibleModels,
    getActiveCustomModelConfig,
    getActiveProfile,
    getDefaultCustomAiProviderSettings,
    loadCustomAiProviderSettings,
    migrateProviderSettings,
    normalizeOpenAiBaseUrl,
    parseOpenAiCompatibleModels,
    removeProviderProfile,
    resetCustomModelStorageAdapter,
    saveCustomAiProviderSettings,
    setActiveProfile,
    setCustomModelStorageAdapter,
    withManualModel,
    withSelectedModel,
    withUpdatedProfile,
} from '../../../services/ai/customModels';
import { activateAccount, clearActiveAccount } from '../../../services/account/accountRuntime';

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
    },
}));

const HOST = 'https://api.example.com/v1';

function createStorageAdapter(seed: Record<string, string> = {}) {
    const store = new Map<string, string>(Object.entries(seed));
    return {
        store,
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

function profileWith(models: { id: string; contextWindow: number }[]) {
    return createProviderProfile({
        label: 'Test provider',
        baseUrl: HOST,
        apiKey: 'test-key',
        models: models.map((m) => ({
            ...m,
            contextWindowSource: 'api' as const,
        })),
    });
}

describe('customModels service (provider profiles, schema v2)', () => {
    const originalFetch = global.fetch;
    let fetchMock: jest.Mock;

    beforeEach(async () => {
        await activateAccount('account-custom-models');
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

    it('normalizes provider roots to OpenAI-compatible v1 bases', () => {
        expect(normalizeOpenAiBaseUrl('https://api.example.com'))
            .toBe('https://api.example.com/v1');
        expect(normalizeOpenAiBaseUrl('http://192.0.2.10:8080'))
            .toBe('http://192.0.2.10:8080/v1');
    });

    it('ships no vendor host, key or model id in its defaults', () => {
        const defaults = getDefaultCustomAiProviderSettings();
        expect(defaults.schemaVersion).toBe(PROVIDER_SETTINGS_SCHEMA_VERSION);
        expect(defaults.enabled).toBe(false);
        expect(defaults.profiles).toHaveLength(1);
        expect(defaults.profiles[0].baseUrl).toBe('');
        expect(defaults.profiles[0].apiKey).toBe('');
        expect(defaults.profiles[0].selectedModelId).toBeNull();
        expect(defaults.profiles[0].models).toEqual([]);
        expect(defaults.activeProfileId).toBe(defaults.profiles[0].id);
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

    it('parses context_length as API-detected context', () => {
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

    it('fetches /models with bearer auth and returns every model when unfiltered', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({
            data: [
                { id: 'openai/gpt-4', context_length: 8192 },
                { id: 'tencent/hy3:free', context_length: 262000 },
            ],
        }), { status: 200 }));

        const result = await fetchOpenAiCompatibleModels({
            baseUrl: 'https://api.example.com',
            apiKey: 'test-key',
        });

        expect(fetchMock).toHaveBeenCalledWith(
            'https://api.example.com/v1/models',
            expect.objectContaining({
                method: 'GET',
                headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
            })
        );
        expect(result.models.map((m) => m.id)).toEqual(['openai/gpt-4', 'tencent/hy3:free']);
    });

    it('applies the user-supplied filter patterns to the fetched catalogue', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({
            data: [
                { id: 'openai/gpt-4', context_length: 8192 },
                { id: 'tencent/hy3:free', context_length: 262000 },
            ],
        }), { status: 200 }));

        const result = await fetchOpenAiCompatibleModels({
            baseUrl: HOST,
            apiKey: 'test-key',
            modelFilterPatterns: [':free'],
        });

        expect(result.models.map((m) => m.id)).toEqual(['tencent/hy3:free']);
    });

    it('reports an empty filtered catalogue instead of silently returning nothing', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({
            data: [{ id: 'openai/gpt-4', context_length: 8192 }],
        }), { status: 200 }));

        await expect(fetchOpenAiCompatibleModels({
            baseUrl: HOST,
            apiKey: 'test-key',
            modelFilterPatterns: [':free'],
        })).rejects.toThrow(/No models matched your filter patterns/);
    });

    it('buildManualModel normalizes id and applies fallback context', () => {
        const model = buildManualModel('  qwen-web/qwen3.8-max  ', 128_000);
        expect(model.id).toBe('qwen-web/qwen3.8-max');
        expect(model.contextWindow).toBe(128_000);
        expect(model.contextWindowSource).toBe('fallback');
        expect(() => buildManualModel('   ', 128_000)).toThrow(/Model id is required/);
    });

    it('withSelectedModel records the pick and rejects ids not in the catalogue', () => {
        const profile = profileWith([{ id: 'tencent/hy3:free', contextWindow: 262_000 }]);
        const next = withSelectedModel(profile, 'tencent/hy3:free');
        expect(next.selectedModelId).toBe('tencent/hy3:free');
        expect(next.recentModelIds).toEqual(['tencent/hy3:free']);
        expect(() => withSelectedModel(profile, 'openai/gpt-4'))
            .toThrow(/not available/);
    });

    it('withManualModel adds, selects and dedupes a hand-typed id', () => {
        const profile = profileWith([]);
        const added = withManualModel(profile, 'qwen-web/qwen3.8-max', 128_000);
        expect(added.models.map((m) => m.id)).toEqual(['qwen-web/qwen3.8-max']);
        expect(added.selectedModelId).toBe('qwen-web/qwen3.8-max');
        expect(added.recentModelIds).toEqual(['qwen-web/qwen3.8-max']);

        const again = withManualModel(added, 'qwen-web/qwen3.8-max', 64_000);
        expect(again.models).toHaveLength(1);
        expect(again.models[0].contextWindow).toBe(64_000);
    });

    it('migrates a v1 flat record into a single v2 profile', () => {
        const migrated = migrateProviderSettings({
            enabled: true,
            baseUrl: HOST,
            apiKey: 'v1-key',
            selectedModelId: 'tencent/hy3:free',
            freeOnly: true,
            recentModelIds: ['tencent/hy3:free'],
            fallbackContextWindow: 64_000,
            updatedAt: 1_700_000_000_000,
            models: [{
                id: 'tencent/hy3:free',
                contextWindow: 262_000,
                contextWindowSource: 'api',
            }],
        });

        expect(migrated.schemaVersion).toBe(PROVIDER_SETTINGS_SCHEMA_VERSION);
        expect(migrated.enabled).toBe(true);
        expect(migrated.profiles).toHaveLength(1);
        expect(migrated.profiles[0].baseUrl).toBe(HOST);
        expect(migrated.profiles[0].apiKey).toBe('v1-key');
        expect(migrated.profiles[0].selectedModelId).toBe('tencent/hy3:free');
        expect(migrated.activeProfileId).toBe(migrated.profiles[0].id);
    });

    it('turns v1 freeOnly into a picker filter rather than a blocking policy', () => {
        const migrated = migrateProviderSettings({
            baseUrl: HOST,
            apiKey: 'v1-key',
            freeOnly: true,
            models: [{ id: 'openai/gpt-4', contextWindow: 8192, contextWindowSource: 'api' }],
        });

        expect(migrated.profiles[0].modelFilterPatterns).toEqual([':free']);
        // The concept is gone: a paid id is still selectable.
        const next = withSelectedModel(migrated.profiles[0], 'openai/gpt-4');
        expect(next.selectedModelId).toBe('openai/gpt-4');
    });

    it('loads a v1 payload from storage through the migration', async () => {
        setCustomModelStorageAdapter(createStorageAdapter({
            [CUSTOM_AI_SETTINGS_KEY]: JSON.stringify({
                enabled: true,
                baseUrl: HOST,
                apiKey: 'legacy-key',
                selectedModelId: 'openai/gpt-4',
                models: [{ id: 'openai/gpt-4', contextWindow: 8192, contextWindowSource: 'api' }],
            }),
        }));

        const loaded = await loadCustomAiProviderSettings();
        expect(loaded.schemaVersion).toBe(PROVIDER_SETTINGS_SCHEMA_VERSION);
        expect(loaded.profiles[0].apiKey).toBe('legacy-key');
        expect(loaded.profiles[0].selectedModelId).toBe('openai/gpt-4');
    });

    it('keeps several providers and switches the active one', () => {
        const base = getDefaultCustomAiProviderSettings();
        const second = createProviderProfile({ label: 'Second' });
        const withTwo = addProviderProfile(base, second);
        expect(withTwo.profiles).toHaveLength(2);
        expect(withTwo.activeProfileId).toBe(second.id);

        const back = setActiveProfile(withTwo, withTwo.profiles[0].id);
        expect(getActiveProfile(back)?.id).toBe(withTwo.profiles[0].id);

        const removed = removeProviderProfile(back, second.id);
        expect(removed.profiles).toHaveLength(1);
        expect(removed.activeProfileId).toBe(removed.profiles[0].id);
    });

    it('refuses to remove the last provider or exceed the profile cap', () => {
        const base = getDefaultCustomAiProviderSettings();
        expect(() => removeProviderProfile(base, base.activeProfileId))
            .toThrow(/At least one provider/);

        let settings = base;
        for (let i = 1; i < MAX_PROVIDER_PROFILES; i += 1) {
            settings = addProviderProfile(settings, createProviderProfile({ label: `P${i}` }));
        }
        expect(settings.profiles).toHaveLength(MAX_PROVIDER_PROFILES);
        expect(() => addProviderProfile(settings, createProviderProfile()))
            .toThrow(/up to 12 providers/);
    });

    it('withUpdatedProfile replaces only the matching profile', () => {
        const base = getDefaultCustomAiProviderSettings();
        const other = createProviderProfile({ label: 'Other' });
        const withTwo = addProviderProfile(base, other);
        const renamed = { ...withTwo.profiles[1], label: 'Renamed' };
        const next = withUpdatedProfile(withTwo, renamed);

        expect(next.profiles).toHaveLength(2);
        expect(next.profiles.find((p) => p.id === other.id)?.label).toBe('Renamed');
        expect(next.profiles.find((p) => p.id === base.profiles[0].id)?.label)
            .toBe(base.profiles[0].label);
    });

    it('resolves the active profile into the transport config', async () => {
        const profile = {
            ...profileWith([{ id: 'tencent/hy3:free', contextWindow: 262_000 }]),
            selectedModelId: 'tencent/hy3:free',
            fallbackModelIds: ['openai/gpt-4'],
        };
        await saveCustomAiProviderSettings({
            ...getDefaultCustomAiProviderSettings(),
            enabled: true,
            activeProfileId: profile.id,
            profiles: [profile],
        });

        const config = await getActiveCustomModelConfig();
        expect(config).toEqual(expect.objectContaining({
            profileId: profile.id,
            apiBaseUrl: HOST,
            apiKey: 'test-key',
            model: 'tencent/hy3:free',
            flashModel: 'tencent/hy3:free',
            contextWindow: 262_000,
            contextWindowSource: 'api',
            fallbackModelIds: ['openai/gpt-4'],
        }));
    });

    it('honours a per-profile flash model and context override', async () => {
        const profile = {
            ...profileWith([
                { id: 'big/model', contextWindow: 262_000 },
                { id: 'small/model', contextWindow: 8_000 },
            ]),
            selectedModelId: 'big/model',
            flashModelId: 'small/model',
            contextWindowOverride: 32_000,
        };
        await saveCustomAiProviderSettings({
            ...getDefaultCustomAiProviderSettings(),
            enabled: true,
            activeProfileId: profile.id,
            profiles: [profile],
        });

        const config = await getActiveCustomModelConfig();
        expect(config?.flashModel).toBe('small/model');
        expect(config?.contextWindow).toBe(32_000);
    });

    it('returns null when provider settings are cleared', async () => {
        await clearCustomAiProviderSettings();
        await expect(getActiveCustomModelConfig()).resolves.toBeNull();
    });

    it('drops a stored selection that is no longer in the catalogue', () => {
        const migrated = migrateProviderSettings({
            schemaVersion: PROVIDER_SETTINGS_SCHEMA_VERSION,
            enabled: true,
            activeProfileId: 'p1',
            profiles: [{
                id: 'p1',
                label: 'Provider',
                baseUrl: HOST,
                apiKey: 'k',
                selectedModelId: 'gone/model',
                models: [{ id: 'kept/model', contextWindow: 8192, contextWindowSource: 'api' }],
            }],
        });

        expect(migrated.profiles[0].selectedModelId).toBeNull();
        expect(migrated.profiles[0].models.map((m) => m.id)).toEqual(['kept/model']);
    });
});
