/**
 * WeekdaySelector Component
 * Horizontal row of weekday buttons (S M T W T F S) + calendar icon
 * Matches today.html design
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import { DayInfo } from '@/hooks/useSelectedDay';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface WeekdaySelectorProps {
    weekDays: DayInfo[];
    selectedDayIndex: number;
    onDaySelect: (dayIndex: number) => void;
}

export function WeekdaySelector({
    weekDays,
    selectedDayIndex,
    onDaySelect,
}: WeekdaySelectorProps) {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const handleCalendarPress = () => {
        router.push('/(tabs)/entries');
    };

    return (
        <View className="flex-row justify-between items-center py-2 px-1">
            {weekDays.map((day) => {
                const isSelected = day.dayIndex === selectedDayIndex;

                return (
                    <Pressable
                        key={day.dayIndex}
                        onPress={() => onDaySelect(day.dayIndex)}
                        accessibilityLabel={`Select ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day.dayIndex]}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        className={`flex items-center justify-center w-10 h-10 rounded-full border ${isSelected
                                ? 'border-primary bg-primary/10'
                                : isDark
                                    ? 'border-border-dark bg-transparent'
                                    : 'border-border-light bg-transparent'
                            }`}
                    >
                        <Text
                            className={`text-sm font-semibold ${isSelected
                                    ? 'text-primary font-bold'
                                    : 'text-text-secondary-light dark:text-text-secondary-dark'
                                }`}
                        >
                            {day.label}
                        </Text>
                    </Pressable>
                );
            })}

            {/* Calendar icon */}
            <Pressable
                onPress={handleCalendarPress}
                accessibilityLabel="Open calendar view"
                accessibilityRole="button"
                className={`flex items-center justify-center w-10 h-10 rounded-full border ${isDark ? 'border-border-dark' : 'border-border-light'
                    } bg-transparent`}
            >
                <MaterialIcons
                    name="calendar-today"
                    size={16}
                    color={isDark ? '#A0A0A0' : '#757575'}
                />
            </Pressable>
        </View>
    );
}
