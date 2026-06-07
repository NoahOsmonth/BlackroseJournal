/**
 * Background task registry.
 *
 * The function is safe to call multiple times — a module-scope
 * `registered` flag short-circuits the second call. That is what makes
 * it safe to invoke from `app/_layout.tsx` on every mount of the root
 * layout (Expo Fast Refresh re-runs effects, but the registry is a
 * no-op after the first call).
 */
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

import { runLocalAiWorker } from './localAiWorker';
import { WORKER_TASK_NAMES } from './taskNames';

let registered = false;

TaskManager.defineTask(WORKER_TASK_NAMES.LOCAL_AI_MAINTENANCE, async () =>
    runLocalAiWorker()
);

/**
 * Register every background worker defined in `WORKER_TASK_NAMES`.
 *
 * Idempotent: the second call is a no-op. Must be called once on
 * app start (see `app/_layout.tsx`). The promise resolves once
 * `TaskManager.isAvailableAsync()` returns; it does not wait for
 * the OS to actually schedule a fetch.
 */
export async function registerAllWorkers(): Promise<void> {
    if (registered) {
        return;
    }
    registered = true;

    const available = await TaskManager.isAvailableAsync();
    if (!available) {
        console.info('[workers] Background tasks not available on this platform.');
        return;
    }

    const taskNames = Object.values(WORKER_TASK_NAMES);
    for (const taskName of taskNames) {
        await BackgroundFetch.registerTaskAsync(taskName, {
            minimumInterval: 60 * 15, // 15 minutes — advisory only on iOS
        });
    }
    console.info(`[workers] Registered ${taskNames.length} background task(s).`);
}
