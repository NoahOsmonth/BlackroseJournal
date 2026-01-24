/**
 * Saved insights storage service
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    SavedInsight,
    SavedInsightCreateInput,
    SavedInsightUpdateInput,
} from './savedInsightsStorage.types';
import {
    fetchRemoteSavedInsights,
    mergeSavedInsights,
    pushSavedInsights,
    queueSavedInsightDelete,
    queueSavedInsightUpsert,
} from './savedInsightsRemote';

const INSIGHTS_KEY = '@saved_insights';
let hasPulledRemote = false;
let hasPushedLocal = false;
let syncPromise: Promise<void> | null = null;

function generateId(): string {
    return `insight_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function loadInsightsMap(): Promise<Record<string, SavedInsight>> {
    const json = await AsyncStorage.getItem(INSIGHTS_KEY);
    return json ? (JSON.parse(json) as Record<string, SavedInsight>) : {};
}

async function saveInsightsMap(map: Record<string, SavedInsight>): Promise<void> {
    await AsyncStorage.setItem(INSIGHTS_KEY, JSON.stringify(map));
}

async function syncFromRemoteIfNeeded(): Promise<void> {
    if (syncPromise) {
        return syncPromise;
    }

    syncPromise = (async () => {
        const local = await loadInsightsMap();
        const hasLocal = Object.keys(local).length > 0;

        if (!hasLocal && !hasPulledRemote) {
            const remote = await fetchRemoteSavedInsights();
            if (remote) {
                hasPulledRemote = true;
                const merged = mergeSavedInsights(local, remote);
                await saveInsightsMap(merged);
            }
        }

        if (hasLocal && !hasPushedLocal) {
            try {
                const pushed = await pushSavedInsights(Object.values(local));
                if (pushed) {
                    hasPushedLocal = true;
                }
            } catch (error) {
                console.warn('Failed to push saved insights:', error);
            }
        }
    })();

    try {
        await syncPromise;
    } finally {
        syncPromise = null;
    }
}

export async function listSavedInsights(): Promise<SavedInsight[]> {
    await syncFromRemoteIfNeeded();
    const map = await loadInsightsMap();
    return Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createSavedInsight(
    input: SavedInsightCreateInput
): Promise<SavedInsight> {
    const now = Date.now();
    const insight: SavedInsight = {
        id: generateId(),
        question: input.question.trim(),
        sourceDate: input.sourceDate,
        createdAt: now,
        updatedAt: now,
    };

    const map = await loadInsightsMap();
    map[insight.id] = insight;
    await saveInsightsMap(map);

    try {
        await queueSavedInsightUpsert(insight);
    } catch (error) {
        console.warn('Failed to queue saved insight sync:', error);
    }

    return insight;
}

export async function updateSavedInsight(
    id: string,
    updates: SavedInsightUpdateInput
): Promise<SavedInsight | null> {
    const map = await loadInsightsMap();
    const existing = map[id];
    if (!existing) {
        return null;
    }

    const updated: SavedInsight = {
        ...existing,
        ...updates,
        question: updates.question ? updates.question.trim() : existing.question,
        updatedAt: Date.now(),
    };

    map[id] = updated;
    await saveInsightsMap(map);

    try {
        await queueSavedInsightUpsert(updated);
    } catch (error) {
        console.warn('Failed to queue saved insight sync:', error);
    }

    return updated;
}

export async function deleteSavedInsight(id: string): Promise<boolean> {
    const map = await loadInsightsMap();
    if (!map[id]) {
        return false;
    }

    delete map[id];
    await saveInsightsMap(map);

    try {
        await queueSavedInsightDelete(id);
    } catch (error) {
        console.warn('Failed to queue saved insight delete:', error);
    }

    return true;
}

export async function clearSavedInsights(): Promise<void> {
    const map = await loadInsightsMap();
    await Promise.all(Object.keys(map).map(async (id) => queueSavedInsightDelete(id)));
    await AsyncStorage.removeItem(INSIGHTS_KEY);
}
