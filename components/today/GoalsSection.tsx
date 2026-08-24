import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { StaggerEntranceItem } from '@/components/ui/StaggerEntrance';
import type { GoalItem } from '@/services/goals/goalsStorage.types';

export interface GoalListItem {
    readonly id: string;
    readonly title: string;
    readonly type: 'goal' | 'habit';
    readonly completed: boolean;
}

interface GoalsSectionProps {
    readonly items: readonly GoalListItem[];
    readonly onAddGoal: () => void;
    readonly onManage: () => void;
    readonly onToggle: (id: string) => void;
}

const MAX_VISIBLE = 5;

function isItemCompleted(item: GoalItem, dateKey: string): boolean {
    if (item.type === 'habit') {
        return (item.habitCompletions ?? []).includes(dateKey);
    }
    return Boolean(item.completed);
}

/** Build checklist rows from goals-for-date + habits for a given local date key. */
export function buildGoalListItems(
    goalsForDate: readonly GoalItem[],
    habits: readonly GoalItem[],
    dateKey: string,
): GoalListItem[] {
    const mapped: GoalListItem[] = [
        ...goalsForDate.map((goal) => ({
            id: goal.id,
            title: goal.title,
            type: 'goal' as const,
            completed: isItemCompleted(goal, dateKey),
        })),
        ...habits.map((habit) => ({
            id: habit.id,
            title: habit.title,
            type: 'habit' as const,
            completed: isItemCompleted(habit, dateKey),
        })),
    ];
    return mapped;
}

function GoalRow({
    item,
    onToggle,
    checkColor,
    emptyCheckColor,
}: {
    readonly item: GoalListItem;
    readonly onToggle: (id: string) => void;
    readonly checkColor: string;
    readonly emptyCheckColor: string;
}) {
    return (
        <Pressable
            onPress={() => onToggle(item.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.completed }}
            accessibilityLabel={`${item.title}, ${item.type}`}
            className="flex-row items-center gap-3 py-2.5 active:opacity-70"
        >
            <MaterialIcons
                name={item.completed ? 'check-circle' : 'radio-button-unchecked'}
                size={22}
                color={item.completed ? checkColor : emptyCheckColor}
            />
            <View className="flex-1 min-w-0">
                <Text
                    numberOfLines={1}
                    className={`text-[15px] font-medium ${
                        item.completed
                            ? 'text-text-secondary-light dark:text-text-secondary-dark line-through'
                            : 'text-text-light dark:text-text-dark'
                    }`}
                >
                    {item.title}
                </Text>
            </View>
            <Text className="text-[11px] font-medium uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
                {item.type}
            </Text>
        </Pressable>
    );
}

export function GoalsSection({
    items,
    onAddGoal,
    onManage,
    onToggle,
}: GoalsSectionProps) {
    const isDark = useColorScheme() === 'dark';
    const checkColor = isDark ? '#34D399' : '#059669';
    const emptyCheckColor = isDark ? '#6B7280' : '#9CA3AF';

    const visible = useMemo(() => items.slice(0, MAX_VISIBLE), [items]);
    const overflow = items.length - visible.length;
    const completedCount = items.filter((item) => item.completed).length;
    const totalCount = items.length;

    return (
        <View className="gap-3">
            <View className="flex-row items-center justify-between px-1">
                <Text className="text-[13px] font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                    Today&apos;s goals
                </Text>
                {totalCount > 0 ? (
                    <Text className="text-[12px] font-medium text-text-secondary-light dark:text-text-secondary-dark">
                        {completedCount}/{totalCount}
                    </Text>
                ) : null}
            </View>

            <View className="bg-surface-light dark:bg-surface-dark rounded-[20px] px-4 py-3 shadow-soft border border-gray-100 dark:border-white/5">
                {visible.length === 0 ? (
                    <Text className="text-[14px] text-text-secondary-light dark:text-text-secondary-dark py-3 text-center">
                        No goals yet — add one for today.
                    </Text>
                ) : (
                    <View>
                        {visible.map((item, index) => (
                            <StaggerEntranceItem
                                key={item.id}
                                index={index}
                                columns={1}
                                totalItems={visible.length}
                                staggerType="linear"
                                baseDelayMs={30}
                                delayFactorMs={45}
                                className="w-full"
                            >
                                {index > 0 ? (
                                    <View className="h-px bg-divider-light dark:bg-divider-dark" />
                                ) : null}
                                <GoalRow
                                    item={item}
                                    onToggle={onToggle}
                                    checkColor={checkColor}
                                    emptyCheckColor={emptyCheckColor}
                                />
                            </StaggerEntranceItem>
                        ))}
                        {overflow > 0 ? (
                            <Pressable
                                onPress={onManage}
                                accessibilityRole="button"
                                accessibilityLabel={`See ${overflow} more goals`}
                                className="pt-2 pb-1"
                            >
                                <Text className="text-[13px] font-medium text-primary text-center">
                                    +{overflow} more · Manage
                                </Text>
                            </Pressable>
                        ) : null}
                    </View>
                )}
            </View>

            <View className="flex-row gap-4">
                <Pressable
                    onPress={onAddGoal}
                    className="flex-1 bg-surface-light dark:bg-surface-dark h-12 rounded-xl items-center justify-center shadow-soft border border-gray-100 dark:border-white/5"
                    accessibilityLabel="Add goal"
                >
                    <Text className="text-sm font-medium text-text-light dark:text-text-dark">
                        Add goal
                    </Text>
                </Pressable>
                <Pressable
                    onPress={onManage}
                    className="flex-1 bg-surface-light dark:bg-surface-dark h-12 rounded-xl items-center justify-center shadow-soft border border-gray-100 dark:border-white/5"
                    accessibilityLabel="Manage goals"
                >
                    <Text className="text-sm font-medium text-text-light dark:text-text-dark">
                        Manage
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}
