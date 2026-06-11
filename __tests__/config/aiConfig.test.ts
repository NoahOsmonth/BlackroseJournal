import type { AiConfig, AiConfigInput } from '../../backend/src/config/ai';

type ConfigModule = {
    getAiConfig: () => AiConfig;
    loadConfig: () => AiConfig;
    validateConfig: (input: AiConfigInput) => void;
};

function freshConfigModule(): ConfigModule {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../backend/src/config/ai') as ConfigModule;
}

describe('backend/src/config/ai — config loader foundation (PR1)', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        delete process.env.AI_DEFAULT_API_KEY;
        delete process.env.AI_DEFAULT_API_BASE_URL;
        delete process.env.AI_DEFAULT_MODEL;
        delete process.env.AI_DEFAULT_FLASH_MODEL;
        delete process.env.NANO_GPT_API_KEY;
        delete process.env.NANO_GPT_API_BASE_URL;
        delete process.env.NANO_GPT_MODEL;
        delete process.env.NANO_GPT_FLASH_MODEL;
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('S1.1 loadConfig() returns a frozen config with the provided key', () => {
        process.env.AI_DEFAULT_API_KEY = 'sk-test';
        process.env.AI_DEFAULT_API_BASE_URL = 'https://api.openai.com/v1';

        const { loadConfig } = freshConfigModule();
        const cfg: AiConfig = loadConfig();

        expect(cfg.apiKey).toBe('sk-test');
        expect(cfg.apiBaseUrl).toBe('https://api.openai.com/v1');
        expect(cfg.model).toBe('nvidia/nemotron-3-ultra-550b-a55b');
        expect(cfg.flashModel).toBe('nvidia/nemotron-3-ultra-550b-a55b');
        expect(Object.isFrozen(cfg)).toBe(true);
    });

    it('S1.2 loadConfig() throws naming the missing AI_DEFAULT_API_KEY field', () => {
        const { loadConfig } = freshConfigModule();

        expect(() => loadConfig()).toThrow(/AI_DEFAULT_API_KEY/);
        try {
            loadConfig();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            expect(message.split('\n').filter(Boolean)).toHaveLength(1);
            expect(message).toMatch(/AI_DEFAULT_API_KEY/);
        }
    });

    it('validateConfig() rejects when apiKey is missing', () => {
        const { validateConfig } = freshConfigModule();
        const input: AiConfigInput = {
            apiBaseUrl: 'https://api.openai.com/v1',
            apiKey: '',
            model: 'm',
            flashModel: 'f',
        };
        expect(() => validateConfig(input)).toThrow(/apiKey/);
    });

    it('validateConfig() rejects when apiBaseUrl is missing', () => {
        const { validateConfig } = freshConfigModule();
        const input: AiConfigInput = {
            apiBaseUrl: '',
            apiKey: 'k',
            model: 'm',
            flashModel: 'f',
        };
        expect(() => validateConfig(input)).toThrow(/apiBaseUrl/);
    });

    it('validateConfig() rejects when model is missing', () => {
        const { validateConfig } = freshConfigModule();
        const input: AiConfigInput = {
            apiBaseUrl: 'https://x',
            apiKey: 'k',
            model: '',
            flashModel: 'f',
        };
        expect(() => validateConfig(input)).toThrow(/model/);
    });

    it('validateConfig() rejects when flashModel is missing', () => {
        const { validateConfig } = freshConfigModule();
        const input: AiConfigInput = {
            apiBaseUrl: 'https://x',
            apiKey: 'k',
            model: 'm',
            flashModel: '',
        };
        expect(() => validateConfig(input)).toThrow(/flashModel/);
    });

    it('validateConfig() accepts a complete input', () => {
        const { validateConfig } = freshConfigModule();
        const input: AiConfigInput = {
            apiBaseUrl: 'https://api.openai.com/v1',
            apiKey: 'k',
            model: 'm',
            flashModel: 'f',
        };
        expect(() => validateConfig(input)).not.toThrow();
    });

    it('loadConfig() defaults model and flashModel to Nemotron Ultra', () => {
        process.env.AI_DEFAULT_API_KEY = 'sk-test';

        const { loadConfig } = freshConfigModule();
        const cfg = loadConfig();

        expect(cfg.model).toBe('nvidia/nemotron-3-ultra-550b-a55b');
        expect(cfg.flashModel).toBe('nvidia/nemotron-3-ultra-550b-a55b');
    });

    it('loadConfig() honors explicit AI_DEFAULT_MODEL overrides', () => {
        process.env.AI_DEFAULT_API_KEY = 'sk-test';
        process.env.AI_DEFAULT_MODEL = 'custom/main';
        process.env.AI_DEFAULT_FLASH_MODEL = 'custom/flash';

        const { loadConfig } = freshConfigModule();
        const cfg = loadConfig();

        expect(cfg.model).toBe('custom/main');
        expect(cfg.flashModel).toBe('custom/flash');
    });

    it('loadConfig() is idempotent — repeat calls return the same frozen object', () => {
        process.env.AI_DEFAULT_API_KEY = 'sk-test';

        const { loadConfig } = freshConfigModule();
        const a = loadConfig();
        const b = loadConfig();

        expect(a).toBe(b);
        expect(Object.isFrozen(a)).toBe(true);
    });

    it('the returned config is frozen — properties cannot be reassigned', () => {
        process.env.AI_DEFAULT_API_KEY = 'sk-test';

        const { loadConfig } = freshConfigModule();
        const cfg = loadConfig();

        expect(Object.isFrozen(cfg)).toBe(true);
        expect(Object.isExtensible(cfg)).toBe(false);
        expect(Object.isSealed(cfg)).toBe(true);
    });

    it('getAiConfig() returns the frozen singleton set by loadConfig()', () => {
        process.env.AI_DEFAULT_API_KEY = 'sk-test';

        const { getAiConfig, loadConfig } = freshConfigModule();
        loadConfig();

        const cfg = getAiConfig();
        expect(cfg.apiKey).toBe('sk-test');
        expect(Object.isFrozen(cfg)).toBe(true);
    });

    it('loadConfig() maps legacy NANO_GPT_* env vars via the shim when AI_DEFAULT_* is unset', () => {
        process.env.NANO_GPT_API_KEY = 'sk-legacy';
        process.env.NANO_GPT_API_BASE_URL = 'https://legacy.example/v1';
        process.env.NANO_GPT_MODEL = 'legacy/main';
        process.env.NANO_GPT_FLASH_MODEL = 'legacy/flash';

        const { loadConfig } = freshConfigModule();
        const cfg = loadConfig();

        expect(cfg.apiKey).toBe('sk-legacy');
        expect(cfg.apiBaseUrl).toBe('https://legacy.example/v1');
        expect(cfg.model).toBe('legacy/main');
        expect(cfg.flashModel).toBe('legacy/flash');
    });

    it('loadConfig() lets new AI_DEFAULT_* names win over legacy NANO_GPT_* when both are set', () => {
        process.env.NANO_GPT_API_KEY = 'sk-legacy';
        process.env.AI_DEFAULT_API_KEY = 'sk-new';
        process.env.AI_DEFAULT_MODEL = 'new/main';
        process.env.NANO_GPT_MODEL = 'legacy/main';

        const { loadConfig } = freshConfigModule();
        const cfg = loadConfig();

        expect(cfg.apiKey).toBe('sk-new');
        expect(cfg.model).toBe('new/main');
    });
});
