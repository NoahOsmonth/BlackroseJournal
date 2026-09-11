import React from 'react';
import { Text, View } from 'react-native';

interface InsightsHeaderProps {
    dateRange: string;
}

export function InsightsHeader({ dateRange }: InsightsHeaderProps) {
    return (
        <View className="mb-5">
            {/* One serif moment per screen. */}
            <Text
                className="text-[34px] leading-tight text-text-light dark:text-text-dark"
                style={{ fontFamily: 'PlayfairDisplayRegular' }}
            >
                Insights
            </Text>
            <Text className="mt-1 text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
                {dateRange}
            </Text>
        </View>
    );
}
