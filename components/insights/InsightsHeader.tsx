import React from 'react';
import { Text, View } from 'react-native';

interface InsightsHeaderProps {
    dateRange: string;
}

export function InsightsHeader({ dateRange }: InsightsHeaderProps) {
    return (
        <View className="mb-5">
            <Text
                className="text-3xl font-bold text-text-light dark:text-text-dark"
                style={{ fontFamily: 'PlayfairDisplayBold' }}
            >
                Insights
            </Text>
            <Text className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                {dateRange}
            </Text>
        </View>
    );
}
