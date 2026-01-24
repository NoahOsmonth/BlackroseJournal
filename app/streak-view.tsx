import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useStreakStats } from '@/hooks/streaks/useStreakStats';
import { buildCalendarDays } from '@/utils/streakStats';

const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function StreakViewScreen() {
    const router = useRouter();
    const { dayKeys, currentStreak, longestStreak, totalDays } = useStreakStats();

    const today = useMemo(() => new Date(), []);
    const monthLabel = useMemo(
        () => today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        [today]
    );
    const calendarDays = useMemo(
        () => buildCalendarDays(dayKeys, today.getFullYear(), today.getMonth()),
        [dayKeys, today]
    );

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full">
                <View className="flex-row items-center justify-between px-4 py-4">
                    <Pressable onPress={() => router.back()} className="p-2 -ml-2" accessibilityLabel="Back">
                        <MaterialIcons name="arrow-back" size={24} color="#111827" />
                    </Pressable>
                    <Text className="text-lg font-semibold text-text-light dark:text-white">Streak</Text>
                    <Pressable
                        onPress={() => router.push('/rewards')}
                        className="px-3 py-1 rounded-full bg-surface-light dark:bg-surface-dark"
                        accessibilityLabel="Open rewards"
                    >
                        <Text className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                            Rewards
                        </Text>
                    </Pressable>
                </View>

                <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
                    <View className="bg-surface-light dark:bg-surface-dark rounded-3xl p-6 shadow-soft border border-gray-100 dark:border-divider-dark">
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center gap-3">
                                <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
                                    <MaterialIcons name="local-fire-department" size={24} color="#FF9500" />
                                </View>
                                <View>
                                    <Text className="text-xs uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
                                        Current streak
                                    </Text>
                                    <Text className="text-3xl font-bold text-text-light dark:text-white">
                                        {currentStreak}
                                    </Text>
                                </View>
                            </View>
                            <View className="items-end">
                                <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                                    Longest
                                </Text>
                                <Text className="text-xl font-semibold text-text-light dark:text-white">
                                    {longestStreak}
                                </Text>
                            </View>
                        </View>
                        <View className="mt-4 pt-4 border-t border-divider-light dark:border-divider-dark">
                            <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                                Total days with check-ins: <Text className="font-bold">{totalDays}</Text>
                            </Text>
                        </View>
                    </View>

                    <View className="mt-8">
                        <Text className="text-lg font-semibold text-text-light dark:text-white mb-4">
                            {monthLabel}
                        </Text>
                        <View className="flex-row flex-wrap">
                            {dayLabels.map((label, index) => (
                                <View key={`label-${label}-${index}`} className="w-[14.28%] items-center py-2">
                                    <Text className="text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark">
                                        {label}
                                    </Text>
                                </View>
                            ))}
                            {calendarDays.map((day, index) => (
                                <View key={`day-${index}`} className="w-[14.28%] items-center py-2">
                                    {day.date ? (
                                        <View
                                            className={`w-8 h-8 rounded-full items-center justify-center ${
                                                day.hasEntry ? 'bg-primary' : 'bg-transparent'
                                            }`}
                                        >
                                            <Text
                                                className={`text-sm ${
                                                    day.hasEntry
                                                        ? 'text-white font-bold'
                                                        : 'text-text-light dark:text-white'
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
                    </View>
                    <View className="h-12" />
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}
