import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface GoalsSectionProps {
    completedCount: number;
    totalCount: number;
    onAddGoal: () => void;
    onManage: () => void;
}

function getGoalMessage(completed: number, total: number): string {
    if (total === 0) {
        return 'Set your first goal for today.';
    }
    if (completed >= total) {
        return 'Nice work! All goals completed for today';
    }
    const remaining = total - completed;
    return `You have ${remaining} goal${remaining === 1 ? '' : 's'} left today.`;
}

export function GoalsSection({
    completedCount,
    totalCount,
    onAddGoal,
    onManage,
}: GoalsSectionProps) {
    const message = getGoalMessage(completedCount, totalCount);

    return (
        <View className="space-y-3">
            <View className="flex-row items-center justify-between px-1">
                <Text className="text-[13px] font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                    Today's goals
                </Text>
            </View>
            <View className="bg-surface-light dark:bg-surface-dark rounded-[24px] p-8 items-center text-center shadow-soft border border-gray-100 dark:border-white/5">
                <View className="mb-5 w-16 h-16 items-center justify-center">
                    <View className="absolute inset-0 bg-pink-500/20 rounded-full" />
                    <View className="w-12 h-12 rounded-full border-4 border-pink-500/50 items-center justify-center">
                        <View className="w-5 h-5 rounded-full bg-pink-500" />
                    </View>
                </View>
                <Text className="text-[15px] font-medium text-text-light dark:text-white max-w-[200px] text-center">
                    {message}
                </Text>
            </View>
            <View className="flex-row gap-3">
                <Pressable
                    onPress={onAddGoal}
                    className="flex-1 bg-surface-light dark:bg-surface-dark h-12 rounded-xl items-center justify-center shadow-soft border border-gray-100 dark:border-white/5"
                    accessibilityLabel="Add goal"
                >
                    <Text className="text-sm font-medium text-text-light dark:text-white">Add goal</Text>
                </Pressable>
                <Pressable
                    onPress={onManage}
                    className="flex-1 bg-surface-light dark:bg-surface-dark h-12 rounded-xl items-center justify-center shadow-soft border border-gray-100 dark:border-white/5"
                    accessibilityLabel="Manage goals"
                >
                    <Text className="text-sm font-medium text-text-light dark:text-white">Manage</Text>
                </Pressable>
            </View>
        </View>
    );
}
