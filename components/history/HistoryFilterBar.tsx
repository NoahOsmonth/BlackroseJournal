import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { HistoryFilter } from '@/hooks/history/historyUtils';

interface HistoryFilterBarProps {
    value: HistoryFilter;
    onChange: (next: HistoryFilter) => void;
}

const OPTIONS: { id: HistoryFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'journal', label: 'Journal' },
    { id: 'ritual', label: 'Rituals' },
];

export function HistoryFilterBar({ value, onChange }: HistoryFilterBarProps) {
    return (
        <View
            className="flex-row items-center gap-2"
            accessibilityRole="tablist"
            accessibilityLabel="Filter history"
        >
            {OPTIONS.map((option) => {
                const active = value === option.id;
                return (
                    <Pressable
                        key={option.id}
                        onPress={() => onChange(option.id)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={option.label}
                        className={`rounded-full px-3.5 py-1.5 ${
                            active
                                ? 'bg-primary dark:bg-primary-dark'
                                : 'bg-surface-light dark:bg-surface-dark border border-divider-light dark:border-divider-dark'
                        }`}
                        style={({ pressed }) => [
                            { opacity: pressed ? 0.88 : 1 },
                        ]}
                    >
                        <Text
                            className={`text-xs font-semibold ${
                                active
                                    ? 'text-white dark:text-gray-900'
                                    : 'text-text-secondary-light dark:text-text-secondary-dark'
                            }`}
                        >
                            {option.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}
