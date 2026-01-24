/**
 * WeekdaySelector Component
 * Horizontal row of weekday buttons
 * Matches today.html design
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
                        accessibilityLabel={`Select ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day.dayIndex]}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        className="flex flex-col items-center gap-1 w-10"
                    >
                        <Text
                            className={`text-[10px] uppercase font-medium ${isSelected
                                ? 'text-white'
                                : 'text-text-secondary-light dark:text-text-secondary-dark'
                                }`}
                        >
                            {day.label}
                        </Text>

                        {isSelected ? (
                            <View className="flex flex-col items-center">
                                <Text className="text-base font-bold text-white mb-1">{day.dayNumber}</Text>
                                <View className="w-1 h-1 rounded-full bg-white" />
                            </View>
                        ) : isCompleted ? (
                            <View className="w-6 h-6 rounded-full bg-accent-green/10 items-center justify-center">
                                <MaterialIcons name="check" size={16} color="#32D74B" />
                            </View>
                        ) : (
                            <Text className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
                                {day.dayNumber}
                            </Text>
                        )}

                        {isSelected && (
                            <View className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-full h-[2px] bg-white rounded-t-full" />
                        )}
                    </Pressable>
                );
            })}
        </View>
    );
}
