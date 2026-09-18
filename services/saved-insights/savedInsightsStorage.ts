/**
 * Saved insights storage service
 */

import { AccountStorageAdapter, getStorageForAccount } from '@/services/account/accountScopedStorage';
import {
    AccountOperationContext,
    assertAccountOperationActive,
    registerAccountTeardown,
    runAccountBoundOperation,
} from '@/services/account/accountRuntime';
import {
    SavedInsight,
    SavedInsightCreateInput,
    SavedInsightUpdateInput,
} from './savedInsightsStorage.types';

const INSIGHTS_KEY = '@saved_insights';
let mutationQueue: Promise<void> = Promise.resolve();

registerAccountTeardown(() => {
    mutationQueue = Promise.resolve();
});

function generateId(): string {
    return `insight_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function loadInsightsMap(storage: AccountStorageAdapter): Promise<Record<string, SavedInsight>> {
    const json = await storage.getItem(INSIGHTS_KEY);
    if (!json) return {};
    try {
        return JSON.parse(json) as Record<string, SavedInsight>;
    } catch {
        return {};
    }
}

async function saveInsightsMap(
    storage: AccountStorageAdapter,
    map: Record<string, SavedInsight>,
): Promise<void> {
    await storage.setItem(INSIGHTS_KEY, JSON.stringify(map));
}

function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

export function listSavedInsights(): Promise<SavedInsight[]> {
    return runAccountBoundOperation('saved-insights-list', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        assertAccountOperationActive(context);
        const map = await loadInsightsMap(storage);
        assertAccountOperationActive(context);
        return Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
    });
}

async function createSavedInsightForAccount(
    input: SavedInsightCreateInput,
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<SavedInsight> {
    const now = Date.now();
    const insight: SavedInsight = {
        id: generateId(),
        question: input.question.trim(),
        sourceDate: input.sourceDate,
        createdAt: now,
        updatedAt: now,
    };

    const map = await loadInsightsMap(storage);
    assertAccountOperationActive(context);
    map[insight.id] = insight;
    await saveInsightsMap(storage, map);
    assertAccountOperationActive(context);

    return insight;
}

export function createSavedInsight(input: SavedInsightCreateInput): Promise<SavedInsight> {
    return runAccountBoundOperation('saved-insights-create', (context) => enqueueMutation(() => (
        createSavedInsightForAccount(input, getStorageForAccount(context.accountId), context)
    )));
}

async function updateSavedInsightForAccount(
    id: string,
    updates: SavedInsightUpdateInput,
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<SavedInsight | null> {
    const map = await loadInsightsMap(storage);
    assertAccountOperationActive(context);
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
    await saveInsightsMap(storage, map);
    assertAccountOperationActive(context);

    return updated;
}

export function updateSavedInsight(
    id: string,
    updates: SavedInsightUpdateInput,
): Promise<SavedInsight | null> {
    return runAccountBoundOperation('saved-insights-update', (context) => enqueueMutation(() => (
        updateSavedInsightForAccount(
            id,
            updates,
            getStorageForAccount(context.accountId),
            context,
        )
    )));
}

async function deleteSavedInsightForAccount(
    id: string,
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<boolean> {
    const map = await loadInsightsMap(storage);
    assertAccountOperationActive(context);
    if (!map[id]) {
        return false;
    }

    delete map[id];
    await saveInsightsMap(storage, map);
    assertAccountOperationActive(context);

    return true;
}

export function deleteSavedInsight(id: string): Promise<boolean> {
    return runAccountBoundOperation('saved-insights-delete', (context) => enqueueMutation(() => (
        deleteSavedInsightForAccount(id, getStorageForAccount(context.accountId), context)
    )));
}

export function clearSavedInsights(): Promise<void> {
    return runAccountBoundOperation('saved-insights-clear', (context) => enqueueMutation(async () => {
        const storage = getStorageForAccount(context.accountId);
        await storage.removeItem(INSIGHTS_KEY);
        assertAccountOperationActive(context);
    }));
}
