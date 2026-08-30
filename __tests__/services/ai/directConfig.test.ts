/* eslint-disable import/first */

/**
 * Tests for services/ai/directConfig.ts.
 *
 * Each test sets up its own env snapshot so order doesn't matter and we
 * never leak values into other test files. We do NOT import the module
 * at the top of the file — instead, we use `jest.isolateModules` +
 * `require()` so that getDirectConfig reads the *current* process.env
 * at call time, which is exactly how the production code works.
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
    getDefaultCustomAiProviderSettings,
    resetCustomModelStorageAdapter,
    saveCustomAiProviderSettings,
    setCustomModelStorageAdapter,
} from '../../../services/ai/customModels';

const KEY = 'EXPO_PUBLIC_NANO_GPT_API_KEY';
const BASE = 'EXPO_PUBLIC_NANO_GPT_API_BASE_URL';
const MODEL = 'EXPO_PUBLIC_NANO_GPT_MODEL';
const FLASH = 'EXPO_PUBLIC_NANO_GPT_FLASH_MODEL';

const VARS = [KEY, BASE, MODEL, FLASH] as const;

function snapshotEnv(): Record<string, string | undefined> {
    const snap: Record<string, string | undefined> = {};
    for (const v of VARS) {
        snap[v] = process.env[v];
    }
    return snap;
}

function restoreEnv(snap: Record<string, string | undefined>): void {
    for (const v of VARS) {
        if (snap[v] === undefined) {
            delete process.env[v];
        } else {
            process.env[v] = snap[v];
        }
    }
}

function clearNanoEnv(): void {
    for (const v of VARS) {
        delete process.env[v];
    }
}

describe('directConfig — getDirectConfig', () => {
    let snap: Record<string, string | undefined>;

    beforeEach(() => {
        snap = snapshotEnv();
        clearNanoEnv();
    });

    afterEach(() => {
        restoreEnv(snap);
    });

    it('1. returns parsed apiKey, apiBaseUrl, model, and flashModel from env', () => {
        process.env[KEY] = 'sk-test-1234';
        process.env[BASE] = 'https://example.com/api/v1';
        process.env[MODEL] = 'custom/thinking';
        process.env[FLASH] = 'custom/fast';

        const cfg = getDirectConfig();

        expect(cfg).toEqual({
            apiKey: 'sk-test-1234',
            apiBaseUrl: 'https://example.com/api/v1',
            model: 'custom/thinking',
            flashModel: 'custom/fast',
        });
    });

    it('2. throws DirectConfigError when EXPO_PUBLIC_NANO_GPT_API_KEY is missing', () => {
        // All env cleared in beforeEach. apiKey is the only required var.
        expect(() => getDirectConfig()).toThrow(DirectConfigError);
        expect(() => getDirectConfig()).toThrow(/EXPO_PUBLIC_NANO_GPT_API_KEY/);
    });

    it('3. throws DirectConfigError when apiKey is the placeholder YOUR_NANO_GPT_API_KEY', () => {
        process.env[KEY] = 'YOUR_NANO_GPT_API_KEY';

        expect(() => getDirectConfig()).toThrow(DirectConfigError);
        expect(() => getDirectConfig()).toThrow(/placeholder/i);
    });

    it('4. falls back to the OmniRoute gateway when base URL env is missing', () => {
        process.env[KEY] = 'sk-test-key';

        const cfg = getDirectConfig();

        expect(cfg.apiBaseUrl).toBe('http://100.107.7.52:20128/v1');
    });

    it('5. falls back to free OpenRouter model defaults', () => {
        process.env[KEY] = 'sk-test-key';

        const cfg = getDirectConfig();

        expect(cfg.model).toBe('cl/dots-studio/dots-3-note-preview:free');
        expect(cfg.flashModel).toBe('cl/dots-studio/dots-3-note-preview:free');
    });
});

describe('directConfig — hasEnvDirectApiKey', () => {
    beforeEach(() => {
        // Clear to a known state so a live .env key leaked from other suites
        // (which restore it in afterEach) can't flip the "missing" assertion.
        delete process.env.EXPO_PUBLIC_NANO_GPT_API_KEY;
    });

    afterEach(() => {
        delete process.env.EXPO_PUBLIC_NANO_GPT_API_KEY;
    });

    it('is false when the env key is missing', () => {
        expect(hasEnvDirectApiKey()).toBe(false);
    });

    it('is false for placeholder keys', () => {
        process.env.EXPO_PUBLIC_NANO_GPT_API_KEY = 'YOUR_OPENROUTER_API_KEY';
        expect(hasEnvDirectApiKey()).toBe(false);
    });

    it('is true for a real key', () => {
        process.env.EXPO_PUBLIC_NANO_GPT_API_KEY = 'sk-real-key';
        expect(hasEnvDirectApiKey()).toBe(true);
    });
});

describe('directConfig — DirectConfigError', () => {
    it('is a subclass of Error with name === "DirectConfigError"', () => {
        const err = new DirectConfigError('boom');
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe('DirectConfigError');
        expect(err.message).toBe('boom');
    });
});

describe('directConfig — getResolvedDirectConfig', () => {
    beforeEach(() => {
        setCustomModelStorageAdapter({
            getItem: jest.fn().mockResolvedValue(null),
            setItem: jest.fn().mockResolvedValue(undefined),
            removeItem: jest.fn().mockResolvedValue(undefined),
        });
    });

    afterEach(() => {
        resetCustomModelStorageAdapter();
    });

    it('uses enabled custom provider settings before NanoGPT env config', async () => {
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

        await expect(getResolvedDirectConfig()).resolves.toEqual({
            apiKey: 'sk-or-test',
            apiBaseUrl: 'https://openrouter.ai/api/v1',
            model: 'tencent/hy3:free',
            flashModel: 'tencent/hy3:free',
            source: 'custom',
            contextWindow: 262000,
            contextWindowSource: 'api',
        });
    });

    it('rejects an already-aborted config resolution before reading BYOK credentials', async () => {
        const previousKey = process.env.EXPO_PUBLIC_NANO_GPT_API_KEY;
        process.env.EXPO_PUBLIC_NANO_GPT_API_KEY = 'sk-env-test';
        const controller = new AbortController();
        controller.abort();
        try {
            await expect(getResolvedDirectConfig(controller.signal)).rejects.toMatchObject({
                name: 'AbortError',
                message: 'AI config resolution was cancelled by an account switch.',
            });
        } finally {
            if (previousKey === undefined) delete process.env.EXPO_PUBLIC_NANO_GPT_API_KEY;
            else process.env.EXPO_PUBLIC_NANO_GPT_API_KEY = previousKey;
        }
    });
});
