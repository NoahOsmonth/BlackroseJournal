describe('getSupermemoryConfig', () => {
    const originalSupermemoryKey = process.env.SUPERMEMORY_API_KEY;
    const originalExpoKey = process.env.EXPO_PUBLIC_SUPERMEMORY_API_KEY;
    const originalExpoBase = process.env.EXPO_PUBLIC_SUPERMEMORY_BASE_URL;

    const loadConfig = (extra: Record<string, string | undefined>) => {
        jest.resetModules();
        jest.doMock('expo-constants', () => ({
            __esModule: true,
            default: {
                manifest: { extra },
                expoGoConfig: { extra },
                expoConfig: { extra },
            },
        }));

        let getSupermemoryConfig: typeof import('../../services/supermemoryConfig').getSupermemoryConfig;

        jest.isolateModules(() => {
            ({ getSupermemoryConfig } = require('../../services/supermemoryConfig'));
        });

        return getSupermemoryConfig();
    };

    afterEach(() => {
        if (originalSupermemoryKey === undefined) {
            delete process.env.SUPERMEMORY_API_KEY;
        } else {
            process.env.SUPERMEMORY_API_KEY = originalSupermemoryKey;
        }

        if (originalExpoKey === undefined) {
            delete process.env.EXPO_PUBLIC_SUPERMEMORY_API_KEY;
        } else {
            process.env.EXPO_PUBLIC_SUPERMEMORY_API_KEY = originalExpoKey;
        }

        if (originalExpoBase === undefined) {
            delete process.env.EXPO_PUBLIC_SUPERMEMORY_BASE_URL;
        } else {
            process.env.EXPO_PUBLIC_SUPERMEMORY_BASE_URL = originalExpoBase;
        }

        jest.resetModules();
        jest.clearAllMocks();
    });

    it('prefers extra config when present', () => {
        const config = loadConfig({
            SUPERMEMORY_API_KEY: 'extra-key',
            SUPERMEMORY_BASE_URL: 'https://extra.example.com',
        });

        expect(config.apiKey).toBe('extra-key');
        expect(config.apiBaseUrl).toBe('https://extra.example.com');
    });

    it('falls back to EXPO_PUBLIC variables on web', () => {
        process.env.EXPO_PUBLIC_SUPERMEMORY_API_KEY = 'public-key';
        process.env.EXPO_PUBLIC_SUPERMEMORY_BASE_URL = 'https://public.example.com';

        const config = loadConfig({});

        expect(config.apiKey).toBe('public-key');
        expect(config.apiBaseUrl).toBe('https://public.example.com');
    });
});
