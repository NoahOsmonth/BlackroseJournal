/**
 * Entry Card Component
 * Individual journal entry row with day abbreviation, emoji, and title
 * Matches journal-history.html design
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface EntryCardProps {
    day: string;
    emoji?: string;
    title: string;
    onPress?: () => void;
}

export function EntryCard({ day, emoji, title, onPress }: EntryCardProps) {
    return (
        <Pressable
            onPress={onPress}
            className="flex-row items-center p-4 active:bg-gray-50 dark:active:bg-white/5"
        >
            <Text className="text-xs font-bold text-subtext-light dark:text-subtext-dark w-10 uppercase">
                {day}
            </Text>
            <View className="flex-1 flex-row items-center gap-2">
                {emoji && <Text className="text-lg">{emoji}</Text>}
                <Text
                    className="font-medium text-text-light dark:text-text-dark flex-1"
                    numberOfLines={1}
                >
                    {title}
                </Text>
            </View>
        </Pressable>
    );
}
