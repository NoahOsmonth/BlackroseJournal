import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { navAwareBottomPadding } from '@/constants/spacing';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useGoals } from '@/hooks/goals/useGoals';
import { useNavBack } from '@/hooks/navigation/useNavBack';
import { GoalGroup } from '@/components/goals/GoalGroup';
import { GoalQuickAddModal } from '@/components/goals/GoalQuickAddModal';
import { getLocalDateKey } from '@/utils/date';
import { habitCurrentStreak } from '@/utils/streakStats';
import { Skeleton } from '@/components/ui/Skeleton';
import { LoadingStatus } from '@/components/ui/LoadingStatus';

export default function GoalsScreen() {
    const goBack = useNavBack('/(tabs)/today');
    const insets = useSafeAreaInsets();
    const isDark = useColorScheme() === 'dark';
    const iconColor = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const { goals, toggle, create, isLoading } = useGoals();
    const [showAdd, setShowAdd] = useState(false);

    const dateKey = useMemo(() => getLocalDateKey(new Date()), []);

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
                <View className="w-full max-w-md flex-1 self-center">
                    <View className="flex-row items-center justify-between px-6 py-4">
                        <Pressable onPress={goBack} className="h-10 w-10 items-center justify-center" accessibilityRole="button" accessibilityLabel="Back">
                            <MaterialIcons name="arrow-back" size={24} color={iconColor} />
                        </Pressable>
                        <Text
                            className="text-[22px] text-text-light dark:text-text-dark"
                            style={{ fontFamily: 'PlayfairDisplayRegular' }}
                        >
                            Goals & Habits
                        </Text>
                        <View className="w-10" />
                    </View>
                    <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
                        <View className="gap-6 pb-10">
                            <LoadingStatus label="Loading goals" compact />
                            <View className="gap-3">
                                <Skeleton className="h-3 w-16" accessibilityLabel="Loading goals header" />
                                {[1, 2, 3].map((index) => (
                                    <Skeleton key={index} className="h-12 w-full rounded-card bg-surface-light dark:bg-surface-dark" accessibilityLabel={`Loading goal ${index}`} />
                                ))}
                            </View>
                            <View className="mt-6 gap-3">
                                <Skeleton className="h-3 w-16" accessibilityLabel="Loading habits header" />
                                {[1, 2].map((index) => (
                                    <Skeleton key={index} className="h-12 w-full rounded-card bg-surface-light dark:bg-surface-dark" accessibilityLabel={`Loading habit ${index}`} />
                                ))}
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </SafeAreaView>
        );
    }

    const todayGoals = goals.filter((goal) => goal.type === 'goal' && goal.dateKey === dateKey);
    const habits = goals.filter((goal) => goal.type === 'habit');

    const handleAdd = async (title: string, type: 'goal' | 'habit') => {
        await create({ title, type, dateKey: type === 'goal' ? dateKey : undefined });
        setShowAdd(false);
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="w-full max-w-md flex-1 self-center">
                <View className="flex-row items-center justify-between px-6 py-4">
                    <Pressable
                        onPress={goBack}
                        className="h-10 w-10 items-center justify-center"
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                        hitSlop={8}
                    >
                        <MaterialIcons name="arrow-back" size={24} color={iconColor} />
                    </Pressable>
                    <Text
                        className="text-[22px] text-text-light dark:text-text-dark"
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                    >
                        Goals & Habits
                    </Text>
                    <Pressable
                        onPress={() => setShowAdd(true)}
                        className="h-10 w-10 items-center justify-center"
                        accessibilityRole="button"
                        accessibilityLabel="Add goal or habit"
                        hitSlop={8}
                    >
                        <MaterialIcons name="add" size={24} color={iconColor} />
                    </Pressable>
                </View>

                <View className="h-px w-full bg-hairline-light dark:bg-hairline-dark" />

                <ScrollView
                    className="flex-1 px-6 pt-6"
                    contentContainerStyle={{ paddingBottom: navAwareBottomPadding(insets.bottom) }}
                    showsVerticalScrollIndicator={false}
                >
                    <View className="gap-8">
                        <GoalGroup
                            label="Today"
                            items={todayGoals.map((goal) => ({
                                id: goal.id,
                                title: goal.title,
                                completed: goal.completed,
                            }))}
                            emptyMessage="Nothing set for today yet."
                            onToggle={(id) => void toggle(id)}
                        />

                        <GoalGroup
                            label="Habits"
                            items={habits.map((habit) => {
                                const completionKeys = habit.habitCompletions ?? [];
                                const streak = habitCurrentStreak(completionKeys, dateKey);
                                return {
                                    id: habit.id,
                                    title: habit.title,
                                    completed: completionKeys.includes(dateKey),
                                    meta: streak > 1 ? `${streak} day streak` : undefined,
                                };
                            })}
                            emptyMessage="No habits yet."
                            onToggle={(id) => void toggle(id, dateKey)}
                        />

                        <Text
                            className="text-center text-[15px] text-text-secondary-light dark:text-text-secondary-dark"
                            style={{ fontFamily: 'PlayfairDisplayRegular', fontStyle: 'italic' }}
                        >
                            Consistency builds quietly.
                        </Text>
                    </View>
                </ScrollView>

                {/* Bottom hairline + the concept's underlined add line. */}
                <View className="h-px w-full bg-hairline-light dark:bg-hairline-dark" />
                <View className="items-center py-4">
                    <Pressable
                        onPress={() => setShowAdd(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Add goal or habit"
                        hitSlop={8}
                    >
                        <Text
                            className="text-[16px] text-text-light underline dark:text-text-dark"
                            style={{ fontFamily: 'PlayfairDisplayRegular' }}
                        >
                            Add goal or habit
                        </Text>
                    </Pressable>
                </View>

                <GoalQuickAddModal
                    visible={showAdd}
                    onClose={() => setShowAdd(false)}
                    onSubmit={handleAdd}
                />
            </View>
        </SafeAreaView>
    );
}
