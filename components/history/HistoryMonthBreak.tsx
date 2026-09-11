import React from 'react';
import { Text, View } from 'react-native';

interface HistoryMonthBreakProps {
    label: string;
}

export function HistoryMonthBreak({ label }: HistoryMonthBreakProps) {
    return (
        <View
            className="flex-row items-center gap-3 py-1"
            accessibilityRole="header"
            accessibilityLabel={label}
        >
            <Text
                className="text-[13px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark"
            >
                {label}
            </Text>
            <View className="h-px flex-1 bg-hairline-light dark:bg-hairline-dark" />
        </View>
    );
}
