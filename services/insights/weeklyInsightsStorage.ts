/**
 * Weekly Insights Storage Service
 * Handles persistence of AI-generated weekly insights with week-based caching
 */

import { WeeklyInsightsResult } from '@/services/ai/ai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    deleteRemoteWeeklyInsights,
    loadRemoteWeeklyInsights,
    saveRemoteWeeklyInsights,
} from './weeklyInsightsRemote';

const STORAGE_KEY = '@weekly_insights_cache';

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
export function getCurrentWeekKey(): string {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const day = now.getDay(); // 0 = Sunday

    // Get the start of current week (Sunday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - day);
    startOfWeek.setHours(0, 0, 0, 0);

    // Calculate week number based on start of week
    const diff = startOfWeek.getTime() - startOfYear.getTime();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const weekNum = Math.floor(diff / oneWeek) + 1;

    return `${now.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
}

/**
 * Load cached insights for a specific week
 */
export async function loadCachedInsights(weekKey: string): Promise<CachedWeeklyInsights | null> {
    try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (!json) {
            const remote = await loadRemoteWeeklyInsights(weekKey);
            if (remote) {
                const cache: CachedWeeklyInsights = {
                    weekKey: remote.weekKey,
                    insights: remote.insights,
                    cachedAt: remote.cachedAt,
                    entryCount: remote.entryCount,
                };
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
                return cache;
            }
            return null;
        }

        const cache = JSON.parse(json) as CachedWeeklyInsights;
        if (cache.weekKey === weekKey) {
            return cache;
        }

        const remote = await loadRemoteWeeklyInsights(weekKey);
        if (remote) {
            const synced: CachedWeeklyInsights = {
                weekKey: remote.weekKey,
                insights: remote.insights,
                cachedAt: remote.cachedAt,
                entryCount: remote.entryCount,
            };
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(synced));
            return synced;
        }

        return null;
    } catch (error) {
        console.error('Failed to load cached insights:', error);
        return null;
    }
}

/**
 * Save insights for the current week
 */
export async function saveCachedInsights(
    weekKey: string,
    insights: WeeklyInsightsResult,
    entryCount: number
): Promise<void> {
    try {
        const cache: CachedWeeklyInsights = {
            weekKey,
            insights,
            cachedAt: Date.now(),
            entryCount,
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
        try {
            await saveRemoteWeeklyInsights(weekKey, insights, entryCount);
        } catch (error) {
            console.error('Failed to sync remote insights:', error);
        }
    } catch (error) {
        console.error('Failed to save cached insights:', error);
        throw error;
    }
}

/**
 * Clear the cached insights (e.g., for testing or force refresh)
 */
export async function clearCachedInsights(): Promise<void> {
    try {
        await AsyncStorage.removeItem(STORAGE_KEY);
        try {
            await deleteRemoteWeeklyInsights(getCurrentWeekKey());
        } catch (error) {
            console.error('Failed to clear remote insights:', error);
        }
    } catch (error) {
        console.error('Failed to clear cached insights:', error);
        throw error;
    }
}
