/* eslint-disable import/first */

/**
 * Tests for services/ai/directConfig.ts.
 *
 * `getDirectConfig()` reads the four `EXPO_PUBLIC_AI_CUSTOM_*` vars at call
 * time, so this suite drives it through `process.env` directly.
 *
 * That only works because `jest.config.js` pins `NODE_ENV=test` before Jest
 * transforms anything: `babel-preset-expo` inlines `process.env.EXPO_PUBLIC_*`
 * at *transform* time, and with a `production` ambient env it freezes every
 * read to a literal (making the module's reads ignore runtime mutations). Six
 * tests here were red at HEAD for that reason alone. If this suite starts
 * failing with "received undefined" on every env case, check the ambient
 * `NODE_ENV` before touching the code under test.
 */
jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
    },
}));

import {
    DirectConfigError,
    getDirectConfig,
    getResolvedDirectConfig,
    hasEnvDirectApiKey,
} from '../../../services/ai/directConfig';
import {
    resetCustomModelStorageAdapter,
    saveCustomAiProviderSettings,
    setCustomModelStorageAdapter,
} from '../../../services/ai/customModels';
import { activateAccount, clearActiveAccount } from '../../../services/account/accountRuntime';
import { makeProviderSettings, testModel, TEST_PROVIDER_HOST } from '../../mocks/providerSettings';

const ENV_KEYS = [
    'EXPO_PUBLIC_AI_CUSTOM_API_KEY',
    'EXPO_PUBLIC_AI_CUSTOM_BASE',
    'EXPO_PUBLIC_AI_CUSTOM_MODEL',
    'EXPO_PUBLIC_AI_CUSTOM_FLASH_MODEL',
] as const;

/** Clear the seed before each test; restore whatever the runner had after. */
function useIsolatedEnvSeed(): void {
    const saved = new Map<string, string | undefined>();

    beforeEach(() => {
        for (const key of ENV_KEYS) {
            saved.set(key, process.env[key]);
            delete process.env[key];
        }
    });

    afterEach(() => {
        for (const key of ENV_KEYS) {
            const value = saved.get(key);
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });
}

describe('directConfig — DirectConfigError', () => {
    it('is a subclass of Error with name === "DirectConfigError"', () => {
        const err = new DirectConfigError('boom');
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe('DirectConfigError');
        expect(err.message).toBe('boom');
    });
});

describe('directConfig — env seed', () => {
    useIsolatedEnvSeed();

    it('throws a configuration error instead of falling back to a vendor host', () => {
        expect(() => getDirectConfig()).toThrow(DirectConfigError);
        expect(() => getDirectConfig()).toThrow(/No AI provider is configured/);
    });

    it('points the user at the two places a provider can be configured', () => {
        expect(() => getDirectConfig()).toThrow(/Settings/);
        expect(() => getDirectConfig()).toThrow(/EXPO_PUBLIC_AI_CUSTOM_API_KEY/);
    });

    it('reports no env API key when the seed is absent', () => {
        expect(hasEnvDirectApiKey()).toBe(false);
    });

    it('returns the seeded provider once key, base and model are present', () => {
        process.env.EXPO_PUBLIC_AI_CUSTOM_API_KEY = 'sk-seeded';
        process.env.EXPO_PUBLIC_AI_CUSTOM_BASE = 'https://api.example.com/v1';
        process.env.EXPO_PUBLIC_AI_CUSTOM_MODEL = 'qwen-web/qwen3.8-max';

        expect(getDirectConfig()).toEqual({
            apiKey: 'sk-seeded',
            apiBaseUrl: 'https://api.example.com/v1',
            model: 'qwen-web/qwen3.8-max',
            flashModel: 'qwen-web/qwen3.8-max',
        });
        expect(hasEnvDirectApiKey()).toBe(true);
    });

    it('uses the seeded flash model when one is given', () => {
        process.env.EXPO_PUBLIC_AI_CUSTOM_API_KEY = 'sk-seeded';
        process.env.EXPO_PUBLIC_AI_CUSTOM_BASE = 'https://api.example.com/v1';
        process.env.EXPO_PUBLIC_AI_CUSTOM_MODEL = 'qwen-web/qwen3.8-max';
        process.env.EXPO_PUBLIC_AI_CUSTOM_FLASH_MODEL = 'tencent/hy3';

        expect(getDirectConfig().flashModel).toBe('tencent/hy3');
    });

    it('treats blank and whitespace-only values as unset', () => {
        process.env.EXPO_PUBLIC_AI_CUSTOM_API_KEY = '   ';

        expect(hasEnvDirectApiKey()).toBe(false);
        expect(() => getDirectConfig()).toThrow(/No AI provider is configured/);
    });

    it('rejects a placeholder key rather than trying to use it', () => {
        process.env.EXPO_PUBLIC_AI_CUSTOM_API_KEY = 'YOUR_API_KEY_HERE';
        process.env.EXPO_PUBLIC_AI_CUSTOM_BASE = 'https://api.example.com/v1';
        process.env.EXPO_PUBLIC_AI_CUSTOM_MODEL = 'qwen-web/qwen3.8-max';

        expect(hasEnvDirectApiKey()).toBe(false);
        expect(() => getDirectConfig()).toThrow(/still a placeholder/);
    });

    it('names the missing base URL', () => {
        process.env.EXPO_PUBLIC_AI_CUSTOM_API_KEY = 'sk-seeded';
        process.env.EXPO_PUBLIC_AI_CUSTOM_MODEL = 'qwen-web/qwen3.8-max';

        expect(() => getDirectConfig()).toThrow(/EXPO_PUBLIC_AI_CUSTOM_BASE is not set/);
    });

    it('names the missing model', () => {
        process.env.EXPO_PUBLIC_AI_CUSTOM_API_KEY = 'sk-seeded';
        process.env.EXPO_PUBLIC_AI_CUSTOM_BASE = 'https://api.example.com/v1';

        expect(() => getDirectConfig()).toThrow(/EXPO_PUBLIC_AI_CUSTOM_MODEL is not set/);
    });
});

describe('directConfig — getResolvedDirectConfig', () => {
    useIsolatedEnvSeed();

    beforeEach(async () => {
        await activateAccount('account-direct-config');
        setCustomModelStorageAdapter({
            getItem: jest.fn().mockResolvedValue(null),
            setItem: jest.fn().mockResolvedValue(undefined),
            removeItem: jest.fn().mockResolvedValue(undefined),
        });
    });

    afterEach(async () => {
        resetCustomModelStorageAdapter();
        await clearActiveAccount();
    });

    it('uses enabled custom provider settings before the env seed', async () => {
        const storage = new Map<string, string>();
        setCustomModelStorageAdapter({
            getItem: (key) => Promise.resolve(storage.get(key) ?? null),
            setItem: (key, value) => {
                storage.set(key, value);
                return Promise.resolve();
            },
            removeItem: (key) => {
                storage.delete(key);
                return Promise.resolve();
            },
        });
        await saveCustomAiProviderSettings(makeProviderSettings({
            enabled: true,
            baseUrl: TEST_PROVIDER_HOST,
            apiKey: 'sk-saved',
            selectedModelId: 'tencent/hy3:free',
            models: [testModel('tencent/hy3:free', 262_000)],
            fallbackModelIds: ['meta/llama-70b-instruct:free'],
        }));

        await expect(getResolvedDirectConfig()).resolves.toEqual({
            apiKey: 'sk-saved',
            apiBaseUrl: TEST_PROVIDER_HOST,
            model: 'tencent/hy3:free',
            flashModel: 'tencent/hy3:free',
            source: 'custom',
            contextWindow: 262_000,
            contextWindowSource: 'api',
            fallbackModelIds: ['meta/llama-70b-instruct:free'],
        });
    });

    it('falls back to the env seed when no custom provider is saved', async () => {
        process.env.EXPO_PUBLIC_AI_CUSTOM_API_KEY = 'sk-seeded';
        process.env.EXPO_PUBLIC_AI_CUSTOM_BASE = 'https://api.example.com/v1';
        process.env.EXPO_PUBLIC_AI_CUSTOM_MODEL = 'qwen-web/qwen3.8-max';

        await expect(getResolvedDirectConfig()).resolves.toEqual({
            apiKey: 'sk-seeded',
            apiBaseUrl: 'https://api.example.com/v1',
            model: 'qwen-web/qwen3.8-max',
            flashModel: 'qwen-web/qwen3.8-max',
            source: 'env',
        });
    });

    it('rejects an already-aborted config resolution before reading BYOK credentials', async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(getResolvedDirectConfig(controller.signal)).rejects.toMatchObject({
            name: 'AbortError',
            message: 'AI config resolution was cancelled by an account switch.',
        });
    });
});
