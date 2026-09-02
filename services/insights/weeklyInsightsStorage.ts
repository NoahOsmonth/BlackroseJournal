/**
 * Weekly Insights Storage Service
 * Handles persistence of AI-generated weekly insights with week-based caching
 */

import type { WeeklyInsightsResult } from '@/services/ai/insightsTypes';
import { AccountStorageAdapter, getStorageForAccount } from '@/services/account/accountScopedStorage';
import {
    AccountOperationContext,
    assertAccountOperationActive,
    registerAccountTeardown,
    runAccountBoundOperation,
} from '@/services/account/accountRuntime';
import {
    deleteRemoteWeeklyInsights,
    loadRemoteWeeklyInsights,
    saveRemoteWeeklyInsights,
} from './weeklyInsightsRemote';

const STORAGE_KEY = '@weekly_insights_cache';
let mutationQueue: Promise<void> = Promise.resolve();

registerAccountTeardown(() => {
    mutationQueue = Promise.resolve();
});

function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

export interface CachedWeeklyInsights {
    weekKey: string;
    insights: WeeklyInsightsResult;
    cachedAt: number;
    entryCount: number;
}

/**
 * Generate a unique key for the current week (Sunday-Saturday)
 * Format: "YYYY-WNN" where NN is the week number
 */
export function getCurrentWeekKey(now: Date = new Date()): string {
    const day = now.getDay(); // 0 = Sunday

    // Get the start of current week (Sunday, normalized to local midnight)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - day);
    startOfWeek.setHours(0, 0, 0, 0);

    // Anchor the label year to the ISO week's Thursday (Sunday+3) so the
    // mid-week boundary week (e.g. Dec 27 2026 → Jan 2 2027) always resolves
    // to one stable key instead of "W53" one day and "W01" the next.
    const thursday = new Date(startOfWeek);
    thursday.setDate(thursday.getDate() + 3);
    const labelYear = thursday.getFullYear();

    // Week 1 is the week containing Jan 1 – anchored to the Sunday on/before
    // it, so week numbers never hit "W00" and stay correct across year
    // boundaries.
    const jan1 = new Date(labelYear, 0, 1);
    const week1Start = new Date(jan1);
    week1Start.setDate(jan1.getDate() - jan1.getDay());

    const diffDays = Math.round((startOfWeek.getTime() - week1Start.getTime()) / (24 * 60 * 60 * 1000));
    const weekNum = Math.floor(diffDays / 7) + 1;

    return `${labelYear}-W${weekNum.toString().padStart(2, '0')}`;
}

/**
 * Load cached insights for a specific week
 */
async function loadCachedInsightsForAccount(
    weekKey: string,
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<CachedWeeklyInsights | null> {
    try {
        const json = await storage.getItem(STORAGE_KEY);
        assertAccountOperationActive(context);
        if (!json) {
            const remote = await loadRemoteWeeklyInsights(weekKey);
            assertAccountOperationActive(context);
            if (remote) {
                const cache: CachedWeeklyInsights = {
                    weekKey: remote.weekKey,
                    insights: remote.insights,
                    cachedAt: remote.cachedAt,
                    entryCount: remote.entryCount,
                };
                await storage.setItem(STORAGE_KEY, JSON.stringify(cache));
                assertAccountOperationActive(context);
                return cache;
            }
            return null;
        }

        let cache: CachedWeeklyInsights;
        try {
            cache = JSON.parse(json) as CachedWeeklyInsights;
        } catch {
            cache = { weekKey: '', insights: {
                emotionalLandscape: [], keyThemes: [], castOfCharacters: [], weeklySummary: '',
            }, cachedAt: 0, entryCount: 0 };
        }
        if (cache.weekKey === weekKey) {
            return cache;
        }

        const remote = await loadRemoteWeeklyInsights(weekKey);
        assertAccountOperationActive(context);
        if (remote) {
            const synced: CachedWeeklyInsights = {
                weekKey: remote.weekKey,
                insights: remote.insights,
                cachedAt: remote.cachedAt,
                entryCount: remote.entryCount,
            };
            await storage.setItem(STORAGE_KEY, JSON.stringify(synced));
            assertAccountOperationActive(context);
            return synced;
        }

        return null;
    } catch (error) {
        assertAccountOperationActive(context);
        console.error('Failed to load cached insights:', error);
        return null;
    }
}

export function loadCachedInsights(weekKey: string): Promise<CachedWeeklyInsights | null> {
    return runAccountBoundOperation('weekly-insights-load', (context) => (
        loadCachedInsightsForAccount(weekKey, getStorageForAccount(context.accountId), context)
    ));
}

/**
 * Save insights for the current week
 */
async function saveCachedInsightsForAccount(
    weekKey: string,
    insights: WeeklyInsightsResult,
    entryCount: number,
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<void> {
    try {
        const cache: CachedWeeklyInsights = {
            weekKey,
            insights,
            cachedAt: Date.now(),
            entryCount,
        };
        await storage.setItem(STORAGE_KEY, JSON.stringify(cache));
        assertAccountOperationActive(context);
        try {
            await saveRemoteWeeklyInsights(weekKey, insights, entryCount);
            assertAccountOperationActive(context);
        } catch (error) {
            if (context.signal.aborted) throw error;
            console.error('Failed to sync remote insights:', error);
        }
    } catch (error) {
        if (context.signal.aborted) throw error;
        console.error('Failed to save cached insights:', error);
        throw error;
    }
}

export function saveCachedInsights(
    weekKey: string,
    insights: WeeklyInsightsResult,
    entryCount: number,
): Promise<void> {
    return runAccountBoundOperation('weekly-insights-save', (context) => enqueueMutation(() => (
        saveCachedInsightsForAccount(
            weekKey,
            insights,
            entryCount,
            getStorageForAccount(context.accountId),
            context,
        )
    )));
}

/**
 * Clear the cached insights (e.g., for testing or force refresh)
 */
async function clearCachedInsightsForAccount(
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<void> {
    try {
        await storage.removeItem(STORAGE_KEY);
        assertAccountOperationActive(context);
        try {
            await deleteRemoteWeeklyInsights(getCurrentWeekKey());
            assertAccountOperationActive(context);
        } catch (error) {
            if (context.signal.aborted) throw error;
            console.error('Failed to clear remote insights:', error);
        }
    } catch (error) {
        console.error('Failed to clear cached insights:', error);
        throw error;
    }
}


export function clearCachedInsights(): Promise<void> {
    return runAccountBoundOperation('weekly-insights-clear', (context) => enqueueMutation(() => (
        clearCachedInsightsForAccount(getStorageForAccount(context.accountId), context)
    )));
}
