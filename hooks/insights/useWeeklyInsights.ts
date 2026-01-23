import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { generateWeeklyInsights, WeeklyInsightsResult } from '@/services/ai/ai';
import {
    getCurrentWeekKey,
    loadCachedInsights,
    saveCachedInsights,
} from '@/services/insights/weeklyInsightsStorage';
import { useCallback, useEffect, useState } from 'react';

export function useWeeklyInsights() {
    const { completed, isLoading: isEntriesLoading } = useJournalEntries();
    const [insights, setInsights] = useState<WeeklyInsightsResult | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter entries for the current week (Sun-Sat)
    const getWeeklyEntries = useCallback(() => {
        const now = new Date();
        const day = now.getDay(); // 0 is Sunday
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - day);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        return completed.filter(entry => {
            const entryDate = new Date(entry.createdAt);
            return entryDate >= startOfWeek && entryDate <= endOfWeek;
        });
    }, [completed]);

    const fetchInsights = useCallback(async (forceRefresh = false) => {
        if (isEntriesLoading) return;

        const weeklyEntries = getWeeklyEntries();
        const weekKey = getCurrentWeekKey();

        // Check for no entries case first
        if (weeklyEntries.length === 0) {
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
                if (cached && cached.entryCount === weeklyEntries.length) {
                    // Cache is valid for this week with same entry count
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
            const result = await generateWeeklyInsights(weeklyEntries.map(e => ({
                messages: e.messages.map(m => ({ content: m.content }))
            })));
            setInsights(result);

            // Cache the results for this week
            try {
                await saveCachedInsights(weekKey, result, weeklyEntries.length);
            } catch (cacheError) {
                console.warn('Failed to cache insights:', cacheError);
            }
        } catch (err) {
            setError('Failed to load insights.');
        } finally {
            setIsAiLoading(false);
        }
    }, [getWeeklyEntries, isEntriesLoading]);

    // Refetch when entries change
    useEffect(() => {
        fetchInsights();
    }, [fetchInsights]);

    // Calculate local stats (not dependent on AI)
    const weeklyStats = (() => {
        const weeklyEntries = getWeeklyEntries();
        const totalWords = weeklyEntries.reduce((sum, entry) => {
            return sum + entry.messages
                .filter(m => m.role === 'user')
                .reduce((acc, m) => acc + m.content.split(/\s+/).filter(Boolean).length, 0);
        }, 0);

        // Daily distribution (Sun-Sat)
        const dailyWords = [0, 0, 0, 0, 0, 0, 0];
        weeklyEntries.forEach(entry => {
            const dayIndex = new Date(entry.createdAt).getDay();
            const words = entry.messages
                .filter(m => m.role === 'user')
                .reduce((acc, m) => acc + m.content.split(/\s+/).filter(Boolean).length, 0);
            dailyWords[dayIndex] += words;
        });

        return {
            entriesCount: weeklyEntries.length,
            totalWords,
            dailyWords,
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
        isLoading: isEntriesLoading || isAiLoading,
        error,
        refresh: fetchInsights,
        forceRefresh,
    };
}
