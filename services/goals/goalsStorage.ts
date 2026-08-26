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
    AccountStorageAdapter,
    claimLegacyStorageKey,
    getStorageForAccount,
} from '@/services/account/accountScopedStorage';
import {
    AccountOperationContext,
    assertAccountOperationActive,
    registerAccountTeardown,
    runAccountBoundOperation,
} from '@/services/account/accountRuntime';

const GOALS_KEY = '@goals';
let hasPulledRemote = false;
let hasPushedLocal = false;
let syncPromise: Promise<void> | null = null;
let mutationQueue: Promise<void> = Promise.resolve();

function generateId(): string {
    return `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function loadGoalsMap(storage: AccountStorageAdapter): Promise<Record<string, GoalItem>> {
    const json = await storage.getItem(GOALS_KEY);
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

async function saveGoalsMap(
    storage: AccountStorageAdapter,
    map: Record<string, GoalItem>,
): Promise<void> {
    await storage.setItem(GOALS_KEY, JSON.stringify(map));
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

async function syncFromRemoteIfNeeded(
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<void> {
    if (syncPromise) {
        return syncPromise;
    }

    syncPromise = (async () => {
        const local = await loadGoalsMap(storage);
        assertAccountOperationActive(context);
        const hasLocal = Object.keys(local).length > 0;

        if (!hasLocal && !hasPulledRemote) {
            const remote = await fetchRemoteGoals();
            assertAccountOperationActive(context);
            if (remote) {
                hasPulledRemote = true;
                await withMutationLock(async () => {
                    const latest = await loadGoalsMap(storage);
                    assertAccountOperationActive(context);
                    await saveGoalsMap(storage, mergeGoals(latest, remote));
                    assertAccountOperationActive(context);
                });
            }
        }

        if (hasLocal && !hasPushedLocal) {
            try {
                const pushed = await pushGoals(Object.values(local));
                assertAccountOperationActive(context);
                if (pushed) {
                    hasPushedLocal = true;
                }
            } catch (error) {
                if (context.signal.aborted) throw error;
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

export function listGoals(): Promise<GoalItem[]> {
    return runAccountBoundOperation('goals-list', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        await syncFromRemoteIfNeeded(storage, context);
        assertAccountOperationActive(context);
        const map = await loadGoalsMap(storage);
        assertAccountOperationActive(context);
        return Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
    });
}

export function getGoal(id: string): Promise<GoalItem | null> {
    return runAccountBoundOperation('goals-get', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        await syncFromRemoteIfNeeded(storage, context);
        assertAccountOperationActive(context);
        const map = await loadGoalsMap(storage);
        assertAccountOperationActive(context);
        return map[id] ?? null;
    });
}

async function queueGoalUpsertForAccount(
    goal: GoalItem,
    context: AccountOperationContext,
): Promise<void> {
    try {
        assertAccountOperationActive(context);
        await queueGoalUpsert(goal);
        assertAccountOperationActive(context);
    } catch (error) {
        if (context.signal.aborted) throw error;
        console.warn('Failed to queue goal sync:', error);
    }
}

export function createGoal(input: GoalCreateInput): Promise<GoalItem> {
    return runAccountBoundOperation('goals-create', async (context) => {
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
        const storage = getStorageForAccount(context.accountId);

        await withMutationLock(async () => {
            const map = await loadGoalsMap(storage);
            assertAccountOperationActive(context);
            map[goal.id] = goal;
            await saveGoalsMap(storage, map);
        });
        assertAccountOperationActive(context);
        await queueGoalUpsertForAccount(goal, context);
        notifyGoalsChanges();
        return goal;
    });
}

export function updateGoal(
    id: string,
    updates: GoalUpdateInput
): Promise<GoalItem | null> {
    return runAccountBoundOperation('goals-update', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        const updated = await withMutationLock(async () => {
            const map = await loadGoalsMap(storage);
            assertAccountOperationActive(context);
            const existing = map[id];
            if (!existing) return null;
            const next: GoalItem = {
                ...existing,
                ...updates,
                title: updates.title ? updates.title.trim() : existing.title,
                updatedAt: Date.now(),
            };
            map[id] = next;
            await saveGoalsMap(storage, map);
            return next;
        });
        assertAccountOperationActive(context);
        if (!updated) return null;
        await queueGoalUpsertForAccount(updated, context);
        notifyGoalsChanges();
        return updated;
    });
}

async function queueGoalDeleteForAccount(
    id: string,
    context: AccountOperationContext,
): Promise<void> {
    try {
        assertAccountOperationActive(context);
        await queueGoalDelete(id);
        assertAccountOperationActive(context);
    } catch (error) {
        if (context.signal.aborted) throw error;
        console.warn('Failed to queue goal sync:', error);
    }
}

export function deleteGoal(id: string): Promise<boolean> {
    return runAccountBoundOperation('goals-delete', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        const deleted = await withMutationLock(async () => {
            const map = await loadGoalsMap(storage);
            assertAccountOperationActive(context);
            if (!map[id]) return false;
            delete map[id];
            await saveGoalsMap(storage, map);
            return true;
        });
        assertAccountOperationActive(context);
        if (!deleted) return false;
        await queueGoalDeleteForAccount(id, context);
        notifyGoalsChanges();
        return true;
    });
}

export function toggleGoalCompletion(
    id: string,
    dateKey?: string
): Promise<GoalItem | null> {
    return runAccountBoundOperation('goals-toggle', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        const updated = await withMutationLock(async () => {
            const map = await loadGoalsMap(storage);
            assertAccountOperationActive(context);
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
            await saveGoalsMap(storage, map);
            return next;
        });
        assertAccountOperationActive(context);
        if (!updated) return null;
        await queueGoalUpsertForAccount(updated, context);
        notifyGoalsChanges();
        return updated;
    });
}

export function markIntentionGoalComplete(
    title: string,
    dateKey: string,
    intentionId?: string
): Promise<GoalItem> {
    return runAccountBoundOperation('goals-mark-intention-complete', async (context) => {
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
        const storage = getStorageForAccount(context.accountId);

        await withMutationLock(async () => {
            const map = await loadGoalsMap(storage);
            assertAccountOperationActive(context);
            map[goal.id] = goal;
            await saveGoalsMap(storage, map);
        });
        assertAccountOperationActive(context);
        await queueGoalUpsertForAccount(goal, context);
        notifyGoalsChanges();
        return goal;
    });
}

export async function listGoalsForDate(dateKey: string): Promise<GoalItem[]> {
    const list = await listGoals();
    return list.filter((goal) => goal.dateKey === dateKey);
}

export async function listHabits(): Promise<GoalItem[]> {
    const list = await listGoals();
    return list.filter((goal) => goal.type === 'habit');
}

export function clearAllGoals(): Promise<void> {
    return runAccountBoundOperation('goals-clear', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        const ids = await withMutationLock(async () => {
            const map = await loadGoalsMap(storage);
            assertAccountOperationActive(context);
            await storage.removeItem(GOALS_KEY);
            return Object.keys(map);
        });
        assertAccountOperationActive(context);
        await Promise.all(ids.map((id) => queueGoalDeleteForAccount(id, context)));
        assertAccountOperationActive(context);
        notifyGoalsChanges();
    });
}

export function migrateLegacyGoalsToActiveAccount(): Promise<void> {
    return runAccountBoundOperation('goals-legacy-migration', async (context) => {
        await withMutationLock(async () => {
            assertAccountOperationActive(context);
            await claimLegacyStorageKey(GOALS_KEY);
            assertAccountOperationActive(context);
        });
    });
}

export async function hasLegacyGoals(): Promise<boolean> {
    return (await AsyncStorage.getItem(GOALS_KEY)) !== null;
}

export function importGoalsSnapshot(
    value: string | null,
    delegate?: (context: AccountOperationContext) => Promise<void>,
): Promise<void> {
    return runAccountBoundOperation('goals-import', async (context) => {
        await withMutationLock(async () => {
            assertAccountOperationActive(context);
            await (delegate ?? importGoalsForAccount)(context, value);
            assertAccountOperationActive(context);
        });
        notifyGoalsChanges();
    });
}

export async function importGoalsForAccount(
    context: AccountOperationContext,
    value: string | null,
): Promise<void> {
    const storage = getStorageForAccount(context.accountId);
    if (value === null) {
        await storage.removeItem(GOALS_KEY);
        return;
    }
    let goals: Record<string, GoalItem> = {};
    try {
        const parsed = JSON.parse(value) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            goals = parsed as Record<string, GoalItem>;
        }
    } catch {
        // Corrupt backup payload restores the owner's safe empty default.
    }
    await saveGoalsMap(storage, goals);
}

registerAccountTeardown(async () => {
    await mutationQueue;
    if (syncPromise) {
        await syncPromise.catch(() => undefined);
    }
    hasPulledRemote = false;
    hasPushedLocal = false;
    syncPromise = null;
});
