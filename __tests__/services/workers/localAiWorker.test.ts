import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';

import {
    LOCAL_AI_WORKER_LAST_RUN_KEY,
    runLocalAiWorker,
} from '../../../services/workers/localAiWorker';

jest.mock('expo-background-fetch', () => ({
    BackgroundFetchResult: {
        NewData: 'newData',
        Failed: 'failed',
    },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    setItem: jest.fn(async () => undefined),
}));

jest.mock('../../../services/ai/directConfig', () => ({
    getDirectConfig: jest.fn(() => ({
        apiKey: 'sk-test',
        apiBaseUrl: 'https://nano-gpt.com/api/v1',
        model: 'moonshotai/kimi-k2.5:thinking',
        flashModel: 'moonshotai/kimi-k2.5',
    })),
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('local AI worker', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('writes a local last-run marker without storing the API key', async () => {
        const result = await runLocalAiWorker(() => 123);

        expect(result).toBe(BackgroundFetch.BackgroundFetchResult.NewData);
        expect(storage.setItem).toHaveBeenCalledTimes(1);

        const [key, raw] = storage.setItem.mock.calls[0] as [string, string];
        expect(key).toBe(LOCAL_AI_WORKER_LAST_RUN_KEY);
        expect(JSON.parse(raw)).toEqual({
            checkedAt: 123,
            apiBaseUrl: 'https://nano-gpt.com/api/v1',
            model: 'moonshotai/kimi-k2.5:thinking',
            flashModel: 'moonshotai/kimi-k2.5',
        });
        expect(raw).not.toContain('sk-test');
    });
});
