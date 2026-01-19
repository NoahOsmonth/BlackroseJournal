/**
 * Entries Modal Component
 * Shows monthly entry breakdown with bar chart
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import { JournalEntry } from '@/services/journalStorage.types';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import { StatsModal } from './StatsModal';

interface EntriesModalProps {
    visible: boolean;
    onClose: () => void;
    entries: JournalEntry[];
}

interface MonthData {
    month: string;
    count: number;
}

export function EntriesModal({ visible, onClose, entries }: EntriesModalProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const monthlyData = useMemo<MonthData[]>(() => {
        const monthCounts = new Map<string, number>();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        entries.forEach((entry) => {
            const date = new Date(entry.createdAt);
            const key = `${months[date.getMonth()]} ${date.getFullYear()}`;
            monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
        });

        // Get last 6 months
        const result: MonthData[] = [];
        const today = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
            result.push({
                month: months[d.getMonth()],
                count: monthCounts.get(key) || 0,
            });
        }

        return result;
    }, [entries]);

    const maxCount = Math.max(...monthlyData.map((d) => d.count), 1);
    const totalEntries = entries.length;
    const avgPerMonth = totalEntries / Math.max(monthlyData.length, 1);

    return (
        <StatsModal visible={visible} onClose={onClose} title="Entries">
            {/* Stats summary */}
            <View className="flex-row gap-4 mb-6">
                <View className={`flex-1 p-4 rounded-xl ${isDark ? 'bg-surface-dark' : 'bg-surface-light'}`}>
                    <Text className="text-3xl font-bold text-primary mb-1">
                        {totalEntries}
                    </Text>
                    <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                        Total entries
                    </Text>
                </View>
                <View className={`flex-1 p-4 rounded-xl ${isDark ? 'bg-surface-dark' : 'bg-surface-light'}`}>
                    <Text className="text-3xl font-bold text-text-main-light dark:text-text-main-dark mb-1">
                        {avgPerMonth.toFixed(1)}
                    </Text>
                    <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                        Avg per month
                    </Text>
                </View>
            </View>

            {/* Bar chart */}
            <Text className="text-lg font-bold text-text-main-light dark:text-text-main-dark mb-4">
                Last 6 Months
            </Text>

            <View className="h-40 flex-row items-end justify-between gap-2">
                {monthlyData.map((data, i) => {
                    const height = maxCount > 0 ? (data.count / maxCount) * 100 : 0;
                    return (
                        <View key={i} className="flex-1 items-center">
                            <Text className="text-xs font-bold text-text-main-light dark:text-text-main-dark mb-1">
                                {data.count}
                            </Text>
                            <View
                                className="w-full bg-primary rounded-t-lg"
                                style={{ height: `${Math.max(height, 5)}%` }}
                            />
                            <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-2">
                                {data.month}
                            </Text>
                        </View>
                    );
                })}
            </View>

            {/* This month */}
            <View className="mt-6 pt-4 border-t border-divider-light dark:border-divider-dark">
                <Text className="text-text-secondary-light dark:text-text-secondary-dark">
                    This month: <Text className="font-bold">{monthlyData[monthlyData.length - 1]?.count || 0}</Text> entries
                </Text>
            </View>
        </StatsModal>
    );
}
