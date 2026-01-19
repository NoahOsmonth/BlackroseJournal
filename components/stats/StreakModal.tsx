/**
 * Streak Modal Component
 * Shows streak calendar and streak statistics
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import { JournalEntry } from '@/services/journalStorage.types';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import { StatsModal } from './StatsModal';

interface StreakModalProps {
    visible: boolean;
    onClose: () => void;
    entries: JournalEntry[];
}

interface StreakStats {
    currentStreak: number;
    longestStreak: number;
    totalDays: number;
    daysWithEntries: Set<string>;
}

function calculateStreakStats(entries: JournalEntry[]): StreakStats {
    const daysWithEntries = new Set<string>();

    entries.forEach((entry) => {
        const date = new Date(entry.createdAt);
        date.setHours(0, 0, 0, 0);
        daysWithEntries.add(date.toDateString());
    });

    // Calculate current streak
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

    return {
        currentStreak,
        longestStreak,
        totalDays: daysWithEntries.size,
        daysWithEntries,
    };
}

export function StreakModal({ visible, onClose, entries }: StreakModalProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const stats = useMemo(() => calculateStreakStats(entries), [entries]);

    // Generate calendar for current month
    const calendarData = useMemo(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startPadding = firstDay.getDay(); // 0 = Sunday

        const days: { date: Date | null; hasEntry: boolean }[] = [];

        // Add padding for days before first of month
        for (let i = 0; i < startPadding; i++) {
            days.push({ date: null, hasEntry: false });
        }

        // Add actual days
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const date = new Date(year, month, d);
            date.setHours(0, 0, 0, 0);
            days.push({
                date,
                hasEntry: stats.daysWithEntries.has(date.toDateString()),
            });
        }

        return days;
    }, [stats.daysWithEntries]);

    const monthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

    return (
        <StatsModal visible={visible} onClose={onClose} title="Streak">
            {/* Stats summary */}
            <View className="flex-row gap-4 mb-6">
                <View className={`flex-1 p-4 rounded-xl ${isDark ? 'bg-surface-dark' : 'bg-surface-light'}`}>
                    <Text className="text-3xl font-bold text-primary mb-1">
                        {stats.currentStreak}
                    </Text>
                    <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                        Current streak
                    </Text>
                </View>
                <View className={`flex-1 p-4 rounded-xl ${isDark ? 'bg-surface-dark' : 'bg-surface-light'}`}>
                    <Text className="text-3xl font-bold text-text-main-light dark:text-text-main-dark mb-1">
                        {stats.longestStreak}
                    </Text>
                    <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                        Longest streak
                    </Text>
                </View>
            </View>

            {/* Calendar */}
            <Text className="text-lg font-bold text-text-main-light dark:text-text-main-dark mb-4">
                {monthName}
            </Text>

            <View className="flex-row flex-wrap">
                {/* Day headers */}
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                    <View key={`header-${i}`} className="w-[14.28%] items-center py-2">
                        <Text className="text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark">
                            {day}
                        </Text>
                    </View>
                ))}

                {/* Calendar days */}
                {calendarData.map((day, i) => (
                    <View key={`day-${i}`} className="w-[14.28%] items-center py-2">
                        {day.date ? (
                            <View
                                className={`w-8 h-8 rounded-full items-center justify-center ${day.hasEntry ? 'bg-primary' : ''
                                    }`}
                            >
                                <Text
                                    className={`text-sm ${day.hasEntry
                                            ? 'text-white font-bold'
                                            : 'text-text-main-light dark:text-text-main-dark'
                                        }`}
                                >
                                    {day.date.getDate()}
                                </Text>
                            </View>
                        ) : (
                            <View className="w-8 h-8" />
                        )}
                    </View>
                ))}
            </View>

            {/* Total days */}
            <View className="mt-6 pt-4 border-t border-divider-light dark:border-divider-dark">
                <Text className="text-text-secondary-light dark:text-text-secondary-dark">
                    Total days with entries: <Text className="font-bold">{stats.totalDays}</Text>
                </Text>
            </View>
        </StatsModal>
    );
}
