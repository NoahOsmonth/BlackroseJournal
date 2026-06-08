import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';

import { getResolvedDirectConfig } from '@/services/ai/directConfig';

export const LOCAL_AI_WORKER_LAST_RUN_KEY = '@blackrose_worker_last_run';

interface LocalAiWorkerSnapshot {
    checkedAt: number;
    apiBaseUrl: string;
    model: string;
    flashModel: string;
}

async function buildSnapshot(now: () => number): Promise<LocalAiWorkerSnapshot> {
    const { apiBaseUrl, model, flashModel } = await getResolvedDirectConfig();
    return {
        checkedAt: now(),
        apiBaseUrl,
        model,
        flashModel,
    };
}

export async function runLocalAiWorker(
    now: () => number = Date.now
): Promise<BackgroundFetch.BackgroundFetchResult> {
    try {
        const snapshot = await buildSnapshot(now);
        await AsyncStorage.setItem(LOCAL_AI_WORKER_LAST_RUN_KEY, JSON.stringify(snapshot));
        return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
        console.warn('[workers] Local AI maintenance failed:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
}
