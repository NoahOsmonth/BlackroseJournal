import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useGoals } from '@/hooks/goals/useGoals';
import { useNavBack } from '@/hooks/navigation/useNavBack';
import { GoalQuickAddModal } from '@/components/goals/GoalQuickAddModal';
import { getLocalDateKey } from '@/utils/date';

export default function GoalsScreen() {
    const goBack = useNavBack('/(tabs)/today');
    const colorScheme = useColorScheme();
    const iconColor = colorScheme === 'dark' ? '#F9FAFB' : '#111827';
    const { goals, toggle, create } = useGoals();
    const [showAdd, setShowAdd] = useState(false);

    const dateKey = useMemo(() => getLocalDateKey(new Date()), []);

    const todayGoals = goals.filter((goal) => goal.type === 'goal' && goal.dateKey === dateKey);
    const habits = goals.filter((goal) => goal.type === 'habit');

    const handleAdd = async (title: string, type: 'goal' | 'habit') => {
        await create({ title, type, dateKey: type === 'goal' ? dateKey : undefined });
        setShowAdd(false);
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full">
                <View className="flex-row items-center justify-between px-4 py-4">
                    <Pressable onPress={goBack} className="p-2 -ml-2">
                        <MaterialIcons name="arrow-back" size={24} color={iconColor} />
                    </Pressable>
                    <Text className="text-lg font-semibold text-text-light dark:text-text-dark">Goals & Habits</Text>
                    <Pressable onPress={() => setShowAdd(true)}>
                        <MaterialIcons name="add" size={24} color={iconColor} />
                    </Pressable>
                </View>

                <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
                    <View className="gap-6 pb-10">
                        <View>
                            <Text className="text-xs uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark mb-2">
                                Today&apos;s goals
                            </Text>
                            <View className="gap-3">
                                {todayGoals.map((goal) => (
                                    <Pressable
                                        key={goal.id}
                                        onPress={() => toggle(goal.id)}
                                        className="bg-surface-light dark:bg-surface-dark rounded-2xl p-4 flex-row items-center justify-between"
                                    >
                                        <Text className="text-base text-text-light dark:text-text-dark">
                                            {goal.title}
                                        </Text>
                                        <MaterialIcons
                                            name={goal.completed ? 'check-circle' : 'radio-button-unchecked'}
                                            size={22}
                                            color={goal.completed ? '#22C55E' : '#9CA3AF'}
                                        />
                                    </Pressable>
                                ))}
                                {todayGoals.length === 0 && (
                                    <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                                        No goals yet. Tap + to add one.
                                    </Text>
                                )}
                            </View>
                        </View>

                        <View>
                            <Text className="text-xs uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark mb-2">
                                Habits
                            </Text>
                            <View className="gap-3">
                                {habits.map((habit) => {
                                    const completed = (habit.habitCompletions ?? []).includes(dateKey);
                                    return (
                                        <Pressable
                                            key={habit.id}
                                            onPress={() => toggle(habit.id, dateKey)}
                                            className="bg-surface-light dark:bg-surface-dark rounded-2xl p-4 flex-row items-center justify-between"
                                        >
                                            <Text className="text-base text-text-light dark:text-text-dark">
                                                {habit.title}
                                            </Text>
                                            <MaterialIcons
                                                name={completed ? 'check-circle' : 'radio-button-unchecked'}
                                                size={22}
                                                color={completed ? '#22C55E' : '#9CA3AF'}
                                            />
                                        </Pressable>
                                    );
                                })}
                                {habits.length === 0 && (
                                    <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                                        No habits yet. Tap + to add one.
                                    </Text>
                                )}
                            </View>
                        </View>
                    </View>
                </ScrollView>

                <GoalQuickAddModal
                    visible={showAdd}
                    onClose={() => setShowAdd(false)}
                    onSubmit={handleAdd}
                />
            </View>
        </SafeAreaView>
    );
}
