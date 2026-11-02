import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { Message } from '@/services/ai/ai';
import { generateWeeklyInsights } from '@/services/ai/insights';
import type { WeeklyInsightsResult } from '@/services/ai/insightsTypes';
import {
    computeWeeklyContentHash,
    getCurrentWeekKey,
    loadCachedInsights,
    saveCachedInsights,
} from '@/services/insights/weeklyInsightsStorage';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface WeeklyInsightItem {
    createdAt: number;
    messages: Message[];
}

function toWeeklyInsightItem<T extends { createdAt: number; messages?: Message[] | null }>(
    item: T
): WeeklyInsightItem {
    return {
        createdAt: item.createdAt,
        messages: item.messages ?? [],
    };
}

/** Local midnight of the Sunday that starts the week containing `now`. */
function currentWeekStart(now: Date = new Date()): number {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return start.getTime();
}

export function useWeeklyInsights() {
    const { completed: journalEntries, isLoading: isEntriesLoading } = useJournalEntries();
    const { completed: checkIns, isLoading: isCheckInsLoading } = useIntentionCheckIns();
    const [insights, setInsights] = useState<WeeklyInsightsResult | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter entries and check-ins for the week starting at `weekStartMs`
    // (local midnight Sunday). The week is a parameter rather than an internal
    // `new Date()` so callers can memoize on it: the collections alone do not
    // change when the clock crosses a week boundary.
    const getWeeklyItems = useCallback((weekStartMs: number) => {
        const startOfWeek = new Date(weekStartMs);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const allItems = [
            ...journalEntries.map(toWeeklyInsightItem),
            ...checkIns.map(toWeeklyInsightItem),
        ];

        return allItems.filter(item => {
            const itemDate = new Date(item.createdAt);
            return itemDate >= startOfWeek && itemDate <= endOfWeek;
        });
    }, [journalEntries, checkIns]);

    const fetchInsights = useCallback(async (forceRefresh = false) => {
        if (isEntriesLoading || isCheckInsLoading) return;

        const weeklyItems = getWeeklyItems(currentWeekStart());
        const weekKey = getCurrentWeekKey();
        const contentHash = computeWeeklyContentHash(weeklyItems);

        // Check for no entries case first
        if (weeklyItems.length === 0) {
            setInsights({
                emotionalLandscape: [],
                keyThemes: [],
                castOfCharacters: [],
                weeklySummary: 'No entries yet this week.',
            });
            return;
        }

        // Try to load cached insights for this week
        if (!forceRefresh) {
            try {
                const cached = await loadCachedInsights(weekKey);
                const contentUnchanged = cached?.contentHash != null
                    ? cached.contentHash === contentHash
                    // Legacy cached record predates the content hash: the best
                    // available signal is still the item count.
                    : cached?.entryCount === weeklyItems.length;
                if (cached && contentUnchanged) {
                    // Cache is valid: same week, same content.
                    setInsights(cached.insights);
                    return;
                }
            } catch (cacheError) {
                console.warn('Failed to load cached insights:', cacheError);
            }
        }

        // Fetch fresh insights from AI
        setIsAiLoading(true);
        setError(null);
        try {
            const result = await generateWeeklyInsights(weeklyItems.map(item => ({
                messages: item.messages.map(m => ({ content: m.content }))
            })));
            setInsights(result);

            // Cache the results for this week
            try {
                await saveCachedInsights(weekKey, result, weeklyItems.length, contentHash);
            } catch (cacheError) {
                console.warn('Failed to cache insights:', cacheError);
            }
        } catch {
            setError('Failed to load insights.');
        } finally {
            setIsAiLoading(false);
        }
    }, [getWeeklyItems, isEntriesLoading, isCheckInsLoading]);

    // Refetch when entries or check-ins change
    useEffect(() => {
        fetchInsights();
    }, [fetchInsights]);

    // One clock reading per render, shared by the stats and the label, so the
    // two can never disagree about which week they describe.
    const renderNow = new Date();
    const renderWeekStart = currentWeekStart(renderNow);

    // Calculate local stats (not dependent on AI). Memoized: this splits every
    // message of the week into words, and as a render-body IIFE it re-ran on
    // every unrelated re-render (including each keystroke-free focus pass).
    // `renderWeekStart` is the dependency that keeps the memo honest: the
    // collections alone do not change when the clock crosses a week boundary, so
    // without it a screen left open keeps the previous week's counts while the
    // label below advances.
    const weeklyStats = useMemo(() => {
        const weeklyItems = getWeeklyItems(renderWeekStart);
        const totalWords = weeklyItems.reduce((sum, item) => {
            return sum + item.messages
                .filter(m => m.role === 'user')
                .reduce((acc, m) => acc + m.content.split(/\s+/).filter(Boolean).length, 0);
        }, 0);

        // Daily distribution (Sun-Sat)
        const dailyWords = [0, 0, 0, 0, 0, 0, 0];
        weeklyItems.forEach(item => {
            const dayIndex = new Date(item.createdAt).getDay();
            const words = item.messages
                .filter(m => m.role === 'user')
                .reduce((acc, m) => acc + m.content.split(/\s+/).filter(Boolean).length, 0);
            dailyWords[dayIndex] += words;
        });

        const maxWords = Math.max(...dailyWords, 0);

        return {
            entriesCount: weeklyItems.length,
            totalWords,
            dailyWords,
            maxWords,
        };
    }, [getWeeklyItems, renderWeekStart]);

    // Cheap date math, off the same clock reading as the stats above.
    const weekDateRange = (() => {
        const now = renderNow;
        const day = now.getDay();
        const start = new Date(now);
        start.setDate(now.getDate() - day);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);

        const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const startLabel = fmt(start);
        const endLabel = fmt(end);
        // Same month collapses to one name and an en-dash day ("Jan 18–24"),
        // matching the Archive week meta line.
        const [startMonth, startDay] = startLabel.split(' ');
        const [endMonth, endDay] = endLabel.split(' ');
        const range = startMonth === endMonth && startDay && endDay
            ? `${startLabel}\u2013${endDay}`
            : `${startLabel}\u2013${endLabel}`;
        return `This week \u00b7 ${range}`;
    })();

    // Force refresh bypasses the cache
    const forceRefresh = useCallback(() => {
        return fetchInsights(true);
    }, [fetchInsights]);

    return {
        insights,
        weeklyStats,
        weekDateRange,
        isLoading: isEntriesLoading || isCheckInsLoading || isAiLoading,
        error,
        refresh: fetchInsights,
        forceRefresh,
    };
}
