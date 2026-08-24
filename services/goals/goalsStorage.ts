/**
 * Goals storage service
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoalCreateInput, GoalItem, GoalUpdateInput } from './goalsStorage.types';
import { getLocalDateKey } from '@/utils/date';
import {
    fetchRemoteGoals,
    mergeGoals,
    pushGoals,
    queueGoalDelete,
    queueGoalUpsert,
} from './goalsRemote';
import {
    claimLegacyStorageKey,
    getAccountScopedStorageKey,
} from '@/services/account/accountScopedStorage';
import { registerAccountTeardown } from '@/services/account/accountRuntime';

const GOALS_KEY = '@goals';
let hasPulledRemote = false;
let hasPushedLocal = false;
let syncPromise: Promise<void> | null = null;
let mutationQueue: Promise<void> = Promise.resolve();

function generateId(): string {
    return `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function loadGoalsMap(): Promise<Record<string, GoalItem>> {
    const json = await AsyncStorage.getItem(getAccountScopedStorageKey(GOALS_KEY));
    if (!json) return {};
    try {
        const parsed = JSON.parse(json) as unknown;
        return parsed && typeof parsed === 'object'
            ? parsed as Record<string, GoalItem>
            : {};
    } catch {
        return {};
    }
}

async function saveGoalsMap(map: Record<string, GoalItem>): Promise<void> {
    await AsyncStorage.setItem(getAccountScopedStorageKey(GOALS_KEY), JSON.stringify(map));
}

function withMutationLock<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

type GoalsChangeListener = () => void;
const goalsChangeListeners = new Set<GoalsChangeListener>();

export function subscribeGoalsChanges(listener: GoalsChangeListener): () => void {
    goalsChangeListeners.add(listener);
    return () => {
        goalsChangeListeners.delete(listener);
    };
}

export function notifyGoalsChanges(): void {
    goalsChangeListeners.forEach((listener) => {
        try {
            listener();
        } catch {
            // A broken listener must never break a write.
        }
    });
}

async function syncFromRemoteIfNeeded(): Promise<void> {
    if (syncPromise) {
        return syncPromise;
    }

    syncPromise = (async () => {
        const local = await loadGoalsMap();
        const hasLocal = Object.keys(local).length > 0;

        if (!hasLocal && !hasPulledRemote) {
            const remote = await fetchRemoteGoals();
            if (remote) {
                hasPulledRemote = true;
                await withMutationLock(async () => {
                    const latest = await loadGoalsMap();
                    await saveGoalsMap(mergeGoals(latest, remote));
                });
            }
        }

        if (hasLocal && !hasPushedLocal) {
            try {
                const pushed = await pushGoals(Object.values(local));
                if (pushed) {
                    hasPushedLocal = true;
                }
            } catch (error) {
                console.warn('Failed to push goals:', error);
            }
        }
    })();

    try {
        await syncPromise;
    } finally {
        syncPromise = null;
    }
}

export async function listGoals(): Promise<GoalItem[]> {
    await syncFromRemoteIfNeeded();
    const map = await loadGoalsMap();
    return Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getGoal(id: string): Promise<GoalItem | null> {
    await syncFromRemoteIfNeeded();
    const map = await loadGoalsMap();
    return map[id] ?? null;
}

export async function createGoal(input: GoalCreateInput): Promise<GoalItem> {
    const now = Date.now();
    const createdAt = typeof input.createdAt === 'number' && Number.isFinite(input.createdAt)
        ? input.createdAt
        : now;
    const updatedAt = typeof input.updatedAt === 'number' && Number.isFinite(input.updatedAt)
        ? input.updatedAt
        : createdAt;
    const goal: GoalItem = {
        id: generateId(),
        title: input.title.trim(),
        type: input.type,
        dateKey: input.dateKey,
        completed: input.type === 'goal' ? false : undefined,
        habitCompletions: input.type === 'habit' ? [] : undefined,
        intentionId: input.intentionId,
        createdAt,
        updatedAt,
    };

    await withMutationLock(async () => {
        const map = await loadGoalsMap();
        map[goal.id] = goal;
        await saveGoalsMap(map);
    });

    try {
        await queueGoalUpsert(goal);
    } catch (error) {
        console.warn('Failed to queue goal sync:', error);
    }

    notifyGoalsChanges();
    return goal;
}

export async function updateGoal(
    id: string,
    updates: GoalUpdateInput
): Promise<GoalItem | null> {
    const updated = await withMutationLock(async () => {
        const map = await loadGoalsMap();
        const existing = map[id];
        if (!existing) return null;
        const next: GoalItem = {
            ...existing,
            ...updates,
            title: updates.title ? updates.title.trim() : existing.title,
            updatedAt: Date.now(),
        };
        map[id] = next;
        await saveGoalsMap(map);
        return next;
    });
    if (!updated) return null;

    try {
        await queueGoalUpsert(updated);
    } catch (error) {
        console.warn('Failed to queue goal sync:', error);
    }

    notifyGoalsChanges();
    return updated;
}

export async function deleteGoal(id: string): Promise<boolean> {
    const deleted = await withMutationLock(async () => {
        const map = await loadGoalsMap();
        if (!map[id]) return false;
        delete map[id];
        await saveGoalsMap(map);
        return true;
    });
    if (!deleted) return false;

    try {
        await queueGoalDelete(id);
    } catch (error) {
        console.warn('Failed to queue goal delete:', error);
    }

    notifyGoalsChanges();
    return true;
}

export async function toggleGoalCompletion(
    id: string,
    dateKey?: string
): Promise<GoalItem | null> {
    const updated = await withMutationLock(async () => {
        const map = await loadGoalsMap();
        const goal = map[id];
        if (!goal) return null;
        const next = { ...goal, updatedAt: Date.now() };
        if (goal.type === 'habit') {
            const key = dateKey ?? getLocalDateKey(new Date());
            const completions = new Set(goal.habitCompletions ?? []);
            if (completions.has(key)) {
                completions.delete(key);
            } else {
                completions.add(key);
            }
            next.habitCompletions = Array.from(completions);
        } else {
            next.completed = !goal.completed;
        }
        map[id] = next;
        await saveGoalsMap(map);
        return next;
    });
    if (!updated) return null;
    try {
        await queueGoalUpsert(updated);
    } catch (error) {
        console.warn('Failed to queue goal sync:', error);
    }
    notifyGoalsChanges();
    return updated;
}

export async function markIntentionGoalComplete(
    title: string,
    dateKey: string,
    intentionId?: string
): Promise<GoalItem> {
    const now = Date.now();
    const goal: GoalItem = {
        id: generateId(),
        title: title.trim(),
        type: 'goal',
        dateKey,
        completed: true,
        intentionId,
        createdAt: now,
        updatedAt: now,
    };

    await withMutationLock(async () => {
        const map = await loadGoalsMap();
        map[goal.id] = goal;
        await saveGoalsMap(map);
    });

    try {
        await queueGoalUpsert(goal);
    } catch (error) {
        console.warn('Failed to queue goal sync:', error);
    }

    notifyGoalsChanges();
    return goal;
}

export async function listGoalsForDate(dateKey: string): Promise<GoalItem[]> {
    const list = await listGoals();
    return list.filter((goal) => goal.dateKey === dateKey);
}

export async function listHabits(): Promise<GoalItem[]> {
    const list = await listGoals();
    return list.filter((goal) => goal.type === 'habit');
}

export async function clearAllGoals(): Promise<void> {
    const ids = await withMutationLock(async () => {
        const map = await loadGoalsMap();
        await AsyncStorage.removeItem(getAccountScopedStorageKey(GOALS_KEY));
        return Object.keys(map);
    });
    await Promise.all(ids.map(async (id) => queueGoalDelete(id)));
    notifyGoalsChanges();
}

export function migrateLegacyGoalsToActiveAccount(): Promise<void> {
    return withMutationLock(async () => {
        await claimLegacyStorageKey(GOALS_KEY);
    });
}

export async function hasLegacyGoals(): Promise<boolean> {
    return (await AsyncStorage.getItem(GOALS_KEY)) !== null;
}

registerAccountTeardown(async () => {
    await mutationQueue;
    if (syncPromise) {
        await syncPromise.catch(() => undefined);
    }
    hasPulledRemote = false;
    hasPushedLocal = false;
    syncPromise = null;
    goalsChangeListeners.clear();
});
