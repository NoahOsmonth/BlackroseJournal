/**
 * WeekdaySelector Component
 * Horizontal row of weekday buttons — no absolute underlines that clip.
 */

import { DayInfo } from '@/hooks/today/useSelectedDay';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface WeekdaySelectorProps {
    weekDays: DayInfo[];
    selectedDayIndex: number;
    onDaySelect: (dayIndex: number) => void;
    completedDayIndices: number[];
}

const DAY_NAMES = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
] as const;

export function WeekdaySelector({
    weekDays,
    selectedDayIndex,
    onDaySelect,
    completedDayIndices,
}: WeekdaySelectorProps) {
    return (
        <View className="flex-row justify-between items-start py-2 border-b border-divider-light dark:border-divider-dark">
            {weekDays.map((day) => {
                const isSelected = day.dayIndex === selectedDayIndex;
                const isCompleted = completedDayIndices.includes(day.dayIndex);

                return (
                    <Pressable
                        key={day.dayIndex}
                        onPress={() => onDaySelect(day.dayIndex)}
                        accessibilityLabel={`Select ${DAY_NAMES[day.dayIndex]}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        className="flex-1 items-center gap-1 py-1"
                    >
                        <Text
                            className={`text-[10px] uppercase font-medium ${
                                isSelected
                                    ? 'text-text-light dark:text-text-dark font-bold'
                                    : 'text-text-secondary-light dark:text-text-secondary-dark'
                            }`}
                        >
                            {day.label}
                        </Text>

                        {isSelected ? (
                            <View className="items-center gap-1">
                                <View className="w-8 h-8 rounded-full bg-primary/15 dark:bg-primary/25 items-center justify-center">
                                    <Text className="text-sm font-bold text-text-light dark:text-text-dark">
                                        {day.dayNumber}
                                    </Text>
                                </View>
                                <View className="w-1 h-1 rounded-full bg-primary" />
                            </View>
                        ) : isCompleted ? (
                            <View className="w-8 h-8 rounded-full bg-accent-green/10 items-center justify-center">
                                <MaterialIcons name="check" size={16} color="#32D74B" />
                            </View>
                        ) : (
                            <View className="w-8 h-8 items-center justify-center">
                                <Text className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
                                    {day.dayNumber}
                                </Text>
                            </View>
                        )}
                    </Pressable>
                );
            })}
        </View>
    );
}
