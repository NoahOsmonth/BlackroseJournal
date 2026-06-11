import { getResolvedDirectConfig } from '../../../services/ai/directConfig';
import {
    clearModelContextCache,
    detectActiveModelContextWindow,
    resetModelContextStorageAdapter,
    setModelContextStorageAdapter,
} from '../../../services/ai/modelContext';

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
    },
}));

jest.mock('../../../services/ai/directConfig', () => ({
    getResolvedDirectConfig: jest.fn(),
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

const envConfig = {
    apiKey: 'sk-test',
    apiBaseUrl: 'https://nano-gpt.com/api/v1',
    model: 'nvidia/nemotron-3-ultra-550b-a55b',
    flashModel: 'nvidia/nemotron-3-ultra-550b-a55b',
    source: 'env' as const,
};

describe('modelContext service', () => {
    const originalFetch = global.fetch;
    let fetchMock: jest.Mock;

    beforeEach(async () => {
        setModelContextStorageAdapter(createStorageAdapter());
        await clearModelContextCache();
        fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
        jest.mocked(getResolvedDirectConfig).mockResolvedValue(envConfig);
    });

    afterEach(() => {
        global.fetch = originalFetch;
        resetModelContextStorageAdapter();
        jest.restoreAllMocks();
    });

    it('detects context from /models and caches the result', async () => {
        fetchMock.mockResolvedValue(new Response(JSON.stringify({
            data: [{ id: envConfig.model, context_length: 256_000 }],
        }), { status: 200 }));

        await expect(detectActiveModelContextWindow()).resolves.toMatchObject({
            model: envConfig.model,
            contextWindow: 256_000,
            source: 'api',
        });
        await expect(detectActiveModelContextWindow()).resolves.toMatchObject({
            contextWindow: 256_000,
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('falls back to known model context when /models fails', async () => {
        fetchMock.mockRejectedValue(new Error('offline'));

        await expect(detectActiveModelContextWindow()).resolves.toMatchObject({
            contextWindow: 1_000_000,
            source: 'known',
        });
    });

    it('uses custom provider context without fetching', async () => {
        jest.mocked(getResolvedDirectConfig).mockResolvedValue({
            ...envConfig,
            source: 'custom',
            model: 'openai/gpt-4o',
            flashModel: 'openai/gpt-4o',
            contextWindow: 64_000,
            contextWindowSource: 'fallback',
        });

        await expect(detectActiveModelContextWindow()).resolves.toMatchObject({
            model: 'openai/gpt-4o',
            contextWindow: 64_000,
            source: 'fallback',
            providerSource: 'custom',
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
