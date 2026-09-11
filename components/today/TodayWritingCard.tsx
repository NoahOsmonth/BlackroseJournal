/**
 * The Today writing surface: an empty-page card that opens the freeform chat.
 * The concept's centrepiece — "What wants your attention?" on a quiet surface,
 * with the caret as the only affordance. Tapping anywhere opens /chat.
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface TodayWritingCardProps {
    onPress?: () => void;
    placeholder?: string;
}

export function TodayWritingCard({
    onPress,
    placeholder = 'What wants your attention?',
}: TodayWritingCardProps) {
    return (
        <Pressable
            onPress={onPress}
            className="min-h-[220px] rounded-card border border-hairline-light bg-surface-light px-5 py-6 dark:border-hairline-dark dark:bg-surface-dark"
            accessibilityLabel={placeholder}
            accessibilityRole="button"
            testID="today-writing-card"
        >
            <Text className="text-[17px] text-text-secondary-light dark:text-text-secondary-dark">
                {placeholder}
            </Text>
            <View className="mt-4 h-5 w-px bg-bone-light dark:bg-bone-dark" />
        </Pressable>
    );
}
