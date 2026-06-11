import {
    DEFAULT_GENERATION,
    GENERATION_PRESETS,
    loadGenerationSettings,
    resetGenerationSettingsStorageAdapter,
    saveGenerationSettings,
    sanitizeGenerationSettings,
    setGenerationSettingsStorageAdapter,
} from '../../../services/ai/generationSettings';

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

describe('generationSettings service', () => {
    beforeEach(() => {
        setGenerationSettingsStorageAdapter(createStorageAdapter());
    });

    afterEach(() => {
        resetGenerationSettingsStorageAdapter();
    });

    it('clamps temperature, topP, and maxTokens to supported ranges', () => {
        expect(sanitizeGenerationSettings({
            temperature: 4,
            topP: -1,
            maxTokens: 999_999,
        }, 8_192)).toEqual({
            temperature: 2,
            topP: 0,
            maxTokens: 8_192,
        });
    });

    it('loads defaults when no settings are stored', async () => {
        await expect(loadGenerationSettings()).resolves.toEqual(DEFAULT_GENERATION);
    });

    it('persists sanitized settings', async () => {
        await saveGenerationSettings({ temperature: 1.4, topP: 0.85, maxTokens: 4_000 });
        await expect(loadGenerationSettings()).resolves.toEqual({
            temperature: 1.4,
            topP: 0.85,
            maxTokens: 4_000,
        });
    });

    it('exposes the expected preset pairs', () => {
        expect(GENERATION_PRESETS.map((preset) => preset.id)).toEqual([
            'consistent',
            'balanced',
            'creative',
        ]);
        expect(GENERATION_PRESETS.find((preset) => preset.id === 'creative'))
            .toMatchObject({ temperature: 1.7, topP: 0.95 });
    });
});
