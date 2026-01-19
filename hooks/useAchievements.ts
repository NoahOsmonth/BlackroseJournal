/**
 * useAchievements Hook
 * Computes achievement progress based on journal entries
 */

import { ACHIEVEMENTS, Achievement } from '@/constants/achievements';
import { useJournalEntries } from '@/hooks/useJournalEntries';
import { useMemo } from 'react';

export interface AchievementProgress {
    achievement: Achievement;
    progress: number;
    isUnlocked: boolean;
    unlockedAt?: string;
}

export interface UseAchievementsReturn {
    achievements: AchievementProgress[];
    unlockedCount: number;
    totalCount: number;
    currentStreak: number;
    longestStreak: number;
}

export function useAchievements(): UseAchievementsReturn {
    const { completed } = useJournalEntries();

    return useMemo(() => {
        // Calculate stats
        const totalEntries = completed.length;
        const totalWords = completed.reduce((sum, entry) => {
            const wordCount = entry.messages
                .filter((m) => m.role === 'user')
                .reduce((acc, m) => acc + m.content.split(/\s+/).filter(Boolean).length, 0);
            return sum + wordCount;
        }, 0);

        // Calculate streak
        const daysWithEntries = new Set<string>();
        completed.forEach((entry) => {
            const date = new Date(entry.createdAt);
            date.setHours(0, 0, 0, 0);
            daysWithEntries.add(date.toDateString());
        });

        let currentStreak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const checkDate = new Date(today);

        while (daysWithEntries.has(checkDate.toDateString())) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        }

        // Calculate longest streak
        let longestStreak = 0;
        let tempStreak = 0;
        const sortedDates = Array.from(daysWithEntries)
            .map((d) => new Date(d))
            .sort((a, b) => a.getTime() - b.getTime());

        for (let i = 0; i < sortedDates.length; i++) {
            if (i === 0) {
                tempStreak = 1;
            } else {
                const diff = sortedDates[i].getTime() - sortedDates[i - 1].getTime();
                const daysDiff = diff / (1000 * 60 * 60 * 24);
                if (daysDiff === 1) {
                    tempStreak++;
                } else {
                    tempStreak = 1;
                }
            }
            longestStreak = Math.max(longestStreak, tempStreak);
        }

        // Compute achievement progress
        const achievements: AchievementProgress[] = ACHIEVEMENTS.map((achievement) => {
            let progress = 0;

            switch (achievement.category) {
                case 'streak':
                    progress = Math.min(longestStreak / achievement.threshold, 1);
                    break;
                case 'entries':
                    progress = Math.min(totalEntries / achievement.threshold, 1);
                    break;
                case 'words':
                    progress = Math.min(totalWords / achievement.threshold, 1);
                    break;
                default:
                    progress = 0;
            }

            return {
                achievement,
                progress,
                isUnlocked: progress >= 1,
            };
        });

        const unlockedCount = achievements.filter((a) => a.isUnlocked).length;

        return {
            achievements,
            unlockedCount,
            totalCount: ACHIEVEMENTS.length,
            currentStreak,
            longestStreak,
        };
    }, [completed]);
}
