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

const GOALS_KEY = '@goals';
let hasPulledRemote = false;
let hasPushedLocal = false;
let syncPromise: Promise<void> | null = null;

function generateId(): string {
    return `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function loadGoalsMap(): Promise<Record<string, GoalItem>> {
    const json = await AsyncStorage.getItem(GOALS_KEY);
    return json ? (JSON.parse(json) as Record<string, GoalItem>) : {};
}

async function saveGoalsMap(map: Record<string, GoalItem>): Promise<void> {
    await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(map));
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
                const merged = mergeGoals(local, remote);
                await saveGoalsMap(merged);
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
    const goal: GoalItem = {
        id: generateId(),
        title: input.title.trim(),
        type: input.type,
        dateKey: input.dateKey,
        completed: input.type === 'goal' ? false : undefined,
        habitCompletions: input.type === 'habit' ? [] : undefined,
        intentionId: input.intentionId,
        createdAt: now,
        updatedAt: now,
    };

    const map = await loadGoalsMap();
    map[goal.id] = goal;
    await saveGoalsMap(map);

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
    const map = await loadGoalsMap();
    const existing = map[id];
    if (!existing) {
        return null;
    }

    const updated: GoalItem = {
        ...existing,
        ...updates,
        title: updates.title ? updates.title.trim() : existing.title,
        updatedAt: Date.now(),
    };

    map[id] = updated;
    await saveGoalsMap(map);

    try {
        await queueGoalUpsert(updated);
    } catch (error) {
        console.warn('Failed to queue goal sync:', error);
    }

    notifyGoalsChanges();
    return updated;
}

export async function deleteGoal(id: string): Promise<boolean> {
    const map = await loadGoalsMap();
    if (!map[id]) {
        return false;
    }

    delete map[id];
    await saveGoalsMap(map);

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
    const goal = await getGoal(id);
    if (!goal) {
        return null;
    }

    if (goal.type === 'habit') {
        const key = dateKey ?? getLocalDateKey(new Date());
        const completions = new Set(goal.habitCompletions ?? []);
        if (completions.has(key)) {
            completions.delete(key);
        } else {
            completions.add(key);
        }
        return updateGoal(id, { habitCompletions: Array.from(completions) });
    }

    return updateGoal(id, { completed: !goal.completed });
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

    const map = await loadGoalsMap();
    map[goal.id] = goal;
    await saveGoalsMap(map);

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
    const map = await loadGoalsMap();
    await Promise.all(Object.keys(map).map(async (id) => queueGoalDelete(id)));
    await AsyncStorage.removeItem(GOALS_KEY);
    notifyGoalsChanges();
}
