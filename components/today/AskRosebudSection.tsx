/**
 * AskRosebudSection Component
 * Section header with time range dropdown
 * Matches today.html design
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import {
    TimeRange,
    TIME_RANGE_LABELS,
} from '@/services/ask-rosebud/askRosebud';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text } from 'react-native';

interface AskRosebudSectionProps {
    selectedTimeRange: TimeRange;
    onTimeRangePress: () => void;
    onSectionPress: () => void;
}

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
