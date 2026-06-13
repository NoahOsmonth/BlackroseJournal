import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { Message } from '@/services/ai/ai';
import { generateWeeklyInsights } from '@/services/ai/insights';
import type { WeeklyInsightsResult } from '@/services/ai/insightsTypes';
import {
    getCurrentWeekKey,
    loadCachedInsights,
    saveCachedInsights,
} from '@/services/insights/weeklyInsightsStorage';
import { useCallback, useEffect, useState } from 'react';

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

export function useWeeklyInsights() {
    const { completed: journalEntries, isLoading: isEntriesLoading } = useJournalEntries();
    const { completed: checkIns, isLoading: isCheckInsLoading } = useIntentionCheckIns();
    const [insights, setInsights] = useState<WeeklyInsightsResult | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter entries and check-ins for the current week (Sun-Sat)
    const getWeeklyItems = useCallback(() => {
        const now = new Date();
        const day = now.getDay(); // 0 is Sunday
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - day);
        startOfWeek.setHours(0, 0, 0, 0);

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

        const weeklyItems = getWeeklyItems();
        const weekKey = getCurrentWeekKey();

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
                if (cached && cached.entryCount === weeklyItems.length) {
                    // Cache is valid for this week with same item count
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
                await saveCachedInsights(weekKey, result, weeklyItems.length);
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

    // Calculate local stats (not dependent on AI)
    const weeklyStats = (() => {
        const weeklyItems = getWeeklyItems();
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
    })();

    const weekDateRange = (() => {
        const now = new Date();
        const day = now.getDay();
        const start = new Date(now);
        start.setDate(now.getDate() - day);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);

        const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${fmt(start)} - ${fmt(end)}`;
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
