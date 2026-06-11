/**
 * PR3 — Provider factory + resolveProfile contract tests.
 *
 * The factory only knows one provider in v1 (`openai-compat`). It must
 * return that provider for every well-known profile name and fall back to
 * it (with a one-time warn) for unknown names so a future typo doesn't
 * crash the runtime.
 */
import { getAiConfig } from '../../../backend/src/config/ai';
import {
    getProviderForProfile,
    __resetProfileWarnForTests,
    type Provider,
} from '../../../backend/src/services/ai/provider';

jest.mock('../../../backend/src/config/ai', () => {
    const real = jest.requireActual('../../../backend/src/config/ai') as typeof import('../../../backend/src/config/ai');
    return {
        getAiConfig: jest.fn(() => real.getAiConfig()),
        loadConfig: jest.fn(() => real.loadConfig()),
        validateConfig: real.validateConfig,
    };
});

const VALID_ENV = {
    AI_DEFAULT_API_KEY: 'sk-test-key-1234',
    AI_DEFAULT_API_BASE_URL: 'https://nano-gpt.com/api/v1',
    AI_DEFAULT_MODEL: 'moonshotai/kimi-k2.5:thinking',
    AI_DEFAULT_FLASH_MODEL: 'moonshotai/kimi-k2.5',
};

describe('provider factory — getProviderForProfile', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        // Reset module-level cache so loadConfig() re-reads env.
        jest.resetModules();
        __resetProfileWarnForTests();
        process.env = { ...originalEnv, ...VALID_ENV };
    });

    afterEach(() => {
        process.env = originalEnv;
        jest.restoreAllMocks();
    });

    it('1. returns the openai-compat provider for "default"', () => {
        const provider = getProviderForProfile('default');
        expect(provider.id).toBe('openai-compat');
    });

    it('2. returns the openai-compat provider for "fast"', () => {
        const provider = getProviderForProfile('fast');
        expect(provider.id).toBe('openai-compat');
    });

    it('3. returns the default provider for unknown names with a one-time warn', () => {
        __resetProfileWarnForTests();
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const a = getProviderForProfile('mystery-profile');
        const b = getProviderForProfile('another-unknown');
        expect(a.id).toBe('openai-compat');
        expect(b.id).toBe('openai-compat');
        const fallthroughWarns = warnSpy.mock.calls.filter((args) =>
            String(args[0] ?? '').toLowerCase().includes('fallthrough') ||
            String(args[0] ?? '').toLowerCase().includes('unknown profile')
        );
        expect(fallthroughWarns.length).toBe(1);
        warnSpy.mockRestore();
    });
});

describe('provider — resolveProfile', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv, ...VALID_ENV };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('4. resolveProfile("default") returns reasoningField === "reasoning_content"', () => {
        const provider: Provider = getProviderForProfile('default');
        const profile = provider.resolveProfile('default');
        expect(profile.capabilities.reasoningField).toBe('reasoning_content');
        expect(profile.capabilities.reasoning).toBe(true);
        expect(profile.capabilities.streaming).toBe(true);
        expect(profile.capabilities.authHeaderStyle).toBe('bearer');
    });

    it('5. resolveProfile("fast") returns model === config.flashModel', () => {
        const provider: Provider = getProviderForProfile('fast');
        const profile = provider.resolveProfile('fast');
        const config = getAiConfig();
        expect(profile.model).toBe(config.flashModel);
    });

    it('6. resolveProfile() propagates errors from the config loader', () => {
        jest.resetModules();
        const configMod = jest.requireMock('../../../backend/src/config/ai') as {
            getAiConfig: jest.Mock;
            loadConfig: jest.Mock;
            validateConfig: unknown;
        };
        configMod.getAiConfig.mockImplementationOnce(() => {
            throw new Error('Invalid AI config: AI_DEFAULT_API_KEY (apiKey) is required.');
        });
        const providerModule = jest.requireActual('../../../backend/src/services/ai/provider') as typeof import('../../../backend/src/services/ai/provider');
        const provider = providerModule.getProviderForProfile('default');
        const result = (() => {
            try {
                provider.resolveProfile('default');
                return null;
            } catch (e) {
                return e;
            }
        })();
        expect(result).toBeInstanceOf(Error);
        expect((result as Error).message).toMatch(/AI_DEFAULT_API_KEY|apiKey/);
    });
});
