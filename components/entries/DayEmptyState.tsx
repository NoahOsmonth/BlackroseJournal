/**
 * The one-tap way out when a chosen day has nothing visible (e.g. a search
 * typed after the day was picked). Pure rendering; the screen owns state.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { HistorySection } from '@/hooks/history/historyUtils';
import { formatWrittenDay } from '@/utils/writtenDays';

interface DayEmptyStateProps {
    readonly section: HistorySection | undefined;
    readonly onClear: () => void;
}

export function DayEmptyState({ section, onClear }: DayEmptyStateProps) {
    return (
        <View className="items-center px-8 pt-16" testID="archive-day-empty">
            <Text
                className="text-center text-[22px] text-text-light dark:text-text-dark"
                style={{ fontFamily: 'PlayfairDisplayRegular' }}
            >
                Nothing written {section ? formatWrittenDay(section) : 'on that day'}
            </Text>
            <Text className="mt-3 text-center text-[15px] leading-[1.5] text-text-secondary-light dark:text-text-secondary-dark">
                Try another day, or clear your search.
            </Text>
            <Pressable
                onPress={onClear}
                accessibilityRole="button"
                accessibilityLabel="Show every day"
                testID="archive-day-clear"
                className="mt-4 min-h-11 justify-center rounded-control border border-hairline-light bg-surface-light px-4 dark:border-hairline-dark dark:bg-surface-dark"
            >
                <Text className="text-[14px] text-text-light dark:text-text-dark">
                    Show every day
                </Text>
            </Pressable>
        </View>
    );
}
