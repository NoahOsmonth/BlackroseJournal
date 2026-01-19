/**
 * AskRosebudSection Component
 * Section header with time range dropdown
 * Matches today.html design
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text } from 'react-native';

export type TimeRange = 'all-time' | 'this-year' | 'this-month' | 'this-week';

interface AskRosebudSectionProps {
    selectedTimeRange: TimeRange;
    onTimeRangePress: () => void;
    onSectionPress: () => void;
}

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
    'all-time': 'All-time',
    'this-year': 'This year',
    'this-month': 'This month',
    'this-week': 'This week',
};

export function AskRosebudSection({
    selectedTimeRange,
    onTimeRangePress,
    onSectionPress,
}: AskRosebudSectionProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    return (
        <Pressable
            onPress={onSectionPress}
            accessibilityLabel="Ask Rosebud"
            accessibilityRole="button"
            className="flex-row justify-between items-center ml-1 pt-2"
        >
            <Text className="text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">
                Ask Rosebud
            </Text>

            <Pressable
                onPress={onTimeRangePress}
                accessibilityLabel={`Time range: ${TIME_RANGE_LABELS[selectedTimeRange]}`}
                accessibilityRole="button"
                className="flex-row items-center"
                hitSlop={8}
            >
                <Text className="text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark">
                    {TIME_RANGE_LABELS[selectedTimeRange]}
                </Text>
                <MaterialIcons
                    name="expand-more"
                    size={16}
                    color={isDark ? '#A0A0A0' : '#757575'}
                    style={{ marginLeft: 4 }}
                />
            </Pressable>
        </Pressable>
    );
}
