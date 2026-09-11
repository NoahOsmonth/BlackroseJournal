import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { SectionLabel } from '@/components/ui/SectionLabel';
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

/**
 * Square checkbox on the left, sage fill when done — the concept's goals list.
 * The trailing meta stays sentence case ("Goal" / "Habit").
 */
function GoalRow({
    item,
    onToggle,
    checkColor,
}: {
    readonly item: GoalListItem;
    readonly onToggle: (id: string) => void;
    readonly checkColor: string;
}) {
    return (
        <Pressable
            onPress={() => onToggle(item.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.completed }}
            accessibilityLabel={`${item.title}, ${item.type}`}
            className="flex-row items-center gap-3 py-3.5 active:opacity-70"
        >
            <View
                className={
                    item.completed
                        ? 'h-6 w-6 items-center justify-center rounded-[3px] bg-ok-light dark:bg-ok-dark'
                        : 'h-6 w-6 items-center justify-center rounded-[3px] border border-hairline-light dark:border-hairline-dark'
                }
            >
                {item.completed ? (
                    <MaterialIcons name="check" size={15} color={checkColor} />
                ) : null}
            </View>
            <View className="min-w-0 flex-1">
                <Text
                    numberOfLines={1}
                    className="text-[16px] text-text-light dark:text-text-dark"
                >
                    {item.title}
                </Text>
            </View>
            <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                {item.type === 'habit' ? 'Habit' : 'Goal'}
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
    const checkColor = isDark ? BLACKROSE_PALETTE.dark.bg : BLACKROSE_PALETTE.light.surface;

    const visible = useMemo(() => items.slice(0, MAX_VISIBLE), [items]);
    const overflow = items.length - visible.length;
    const completedCount = items.filter((item) => item.completed).length;
    const totalCount = items.length;

    return (
        <View className="gap-2">
            <SectionLabel
                action={
                    totalCount > 0 ? (
                        <Text className="text-[12px] text-text-secondary-light dark:text-text-secondary-dark">
                            {completedCount}/{totalCount}
                        </Text>
                    ) : undefined
                }
            >
                Goals
            </SectionLabel>

            {visible.length === 0 ? (
                <Pressable
                    onPress={onAddGoal}
                    accessibilityLabel="Add goal"
                    accessibilityRole="button"
                    className="py-3"
                >
                    <Text className="text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
                        Add a goal for today
                    </Text>
                </Pressable>
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
                                <View className="h-px bg-hairline-light dark:bg-hairline-dark" />
                            ) : null}
                            <GoalRow
                                item={item}
                                onToggle={onToggle}
                                checkColor={checkColor}
                            />
                        </StaggerEntranceItem>
                    ))}
                    {overflow > 0 ? (
                        <Pressable
                            onPress={onManage}
                            accessibilityRole="button"
                            accessibilityLabel={`See ${overflow} more goals`}
                            className="pt-3"
                        >
                            <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                                +{overflow} more
                            </Text>
                        </Pressable>
                    ) : null}
                </View>
            )}
        </View>
    );
}
