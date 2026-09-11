/**
 * WeekdaySelector Component
 * Horizontal row of weekday buttons — no absolute underlines that clip.
 */

import { DayInfo } from '@/hooks/today/useSelectedDay';
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
        <View className="flex-row justify-between items-start">
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
                        className="flex-1 items-center gap-2 py-1"
                    >
                        <Text
                            className={`text-[11px] uppercase tracking-[1.3px] ${
                                isSelected
                                    ? 'text-text-light dark:text-text-dark'
                                    : 'text-text-secondary-light dark:text-text-secondary-dark'
                            }`}
                        >
                            {day.label}
                        </Text>

                        <Text
                            className={`text-[15px] ${
                                isSelected
                                    ? 'text-text-light dark:text-text-dark'
                                    : 'text-text-secondary-light dark:text-text-secondary-dark'
                            }`}
                        >
                            {day.dayNumber}
                        </Text>

                        {/* One thin mark: selected day, or a completed tick. No pills. */}
                        <View
                            className={`h-0.5 w-4 rounded-full ${
                                isSelected
                                    ? 'bg-bone-light dark:bg-bone-dark'
                                    : isCompleted
                                        ? 'bg-ok-light dark:bg-ok-dark'
                                        : 'bg-transparent'
                            }`}
                        />
                    </Pressable>
                );
            })}
        </View>
    );
}
