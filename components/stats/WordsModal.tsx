/**
 * Words Modal Component
 * Shows word count statistics and trend
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import { JournalEntry } from '@/services/journalStorage.types';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import { StatsModal } from './StatsModal';

interface WordsModalProps {
    visible: boolean;
    onClose: () => void;
    entries: JournalEntry[];
}

function countWords(entry: JournalEntry): number {
    return entry.messages
        .filter((m) => m.role === 'user')
        .reduce((acc, m) => acc + m.content.split(/\s+/).filter(Boolean).length, 0);
}

export function WordsModal({ visible, onClose, entries }: WordsModalProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const stats = useMemo(() => {
        if (entries.length === 0) {
            return { total: 0, average: 0, weeklyData: [] };
        }

        const wordCounts = entries.map(countWords);
        const total = wordCounts.reduce((a, b) => a + b, 0);
        const average = total / entries.length;

        // Get last 7 days of data
        const weeklyData: { day: string; words: number }[] = [];
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            const dayEntries = entries.filter((e) => {
                const entryDate = new Date(e.createdAt);
                entryDate.setHours(0, 0, 0, 0);
                return entryDate.getTime() === date.getTime();
            });

            const dayWords = dayEntries.reduce((sum, e) => sum + countWords(e), 0);

            weeklyData.push({
                day: days[date.getDay()],
                words: dayWords,
            });
        }

        return { total, average, weeklyData };
    }, [entries]);

    const maxWords = Math.max(...stats.weeklyData.map((d) => d.words), 1);

    return (
        <StatsModal visible={visible} onClose={onClose} title="Words">
            {/* Stats summary */}
            <View className="flex-row gap-4 mb-6">
                <View className={`flex-1 p-4 rounded-xl ${isDark ? 'bg-surface-dark' : 'bg-surface-light'}`}>
                    <Text className="text-3xl font-bold text-primary mb-1">
                        {stats.total.toLocaleString()}
                    </Text>
                    <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                        Total words
                    </Text>
                </View>
                <View className={`flex-1 p-4 rounded-xl ${isDark ? 'bg-surface-dark' : 'bg-surface-light'}`}>
                    <Text className="text-3xl font-bold text-text-main-light dark:text-text-main-dark mb-1">
                        {Math.round(stats.average)}
                    </Text>
                    <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                        Avg per entry
                    </Text>
                </View>
            </View>

            {/* Line chart (simplified as bar) */}
            <Text className="text-lg font-bold text-text-main-light dark:text-text-main-dark mb-4">
                Last 7 Days
            </Text>

            <View className="h-40 flex-row items-end justify-between gap-2">
                {stats.weeklyData.map((data, i) => {
                    const height = maxWords > 0 ? (data.words / maxWords) * 100 : 0;
                    const isToday = i === stats.weeklyData.length - 1;
                    return (
                        <View key={i} className="flex-1 items-center">
                            <Text className="text-xs font-bold text-text-main-light dark:text-text-main-dark mb-1">
                                {data.words > 0 ? data.words : ''}
                            </Text>
                            <View
                                className={`w-full rounded-t-lg ${isToday ? 'bg-primary' : 'bg-blue-300 dark:bg-blue-600'}`}
                                style={{ height: `${Math.max(height, data.words > 0 ? 10 : 0)}%` }}
                            />
                            <Text className={`text-xs mt-2 ${isToday ? 'font-bold text-primary' : 'text-text-secondary-light dark:text-text-secondary-dark'}`}>
                                {data.day}
                            </Text>
                        </View>
                    );
                })}
            </View>

            {/* Today's words */}
            <View className="mt-6 pt-4 border-t border-divider-light dark:border-divider-dark">
                <Text className="text-text-secondary-light dark:text-text-secondary-dark">
                    Today: <Text className="font-bold">{stats.weeklyData[stats.weeklyData.length - 1]?.words || 0}</Text> words
                </Text>
            </View>
        </StatsModal>
    );
}
