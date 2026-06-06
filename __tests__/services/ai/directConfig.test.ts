/**
 * Tests for services/ai/directConfig.ts.
 *
 * Each test sets up its own env snapshot so order doesn't matter and we
 * never leak values into other test files. We do NOT import the module
 * at the top of the file — instead, we use `jest.isolateModules` +
 * `require()` so that getDirectConfig reads the *current* process.env
 * at call time, which is exactly how the production code works.
 */
import {
    DirectConfigError,
    getDirectConfig,
} from '../../../services/ai/directConfig';

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

    it('4. falls back to https://nano-gpt.com/api/v1 when base URL env is missing', () => {
        process.env[KEY] = 'sk-test-key';

        const cfg = getDirectConfig();

        expect(cfg.apiBaseUrl).toBe('https://nano-gpt.com/api/v1');
    });

    it('5. falls back to moonshotai/kimi-k2.5:thinking and moonshotai/kimi-k2.5 for models', () => {
        process.env[KEY] = 'sk-test-key';

        const cfg = getDirectConfig();

        expect(cfg.model).toBe('moonshotai/kimi-k2.5:thinking');
        expect(cfg.flashModel).toBe('moonshotai/kimi-k2.5');
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
