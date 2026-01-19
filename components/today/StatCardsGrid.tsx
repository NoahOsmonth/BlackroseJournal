/**
 * StatCardsGrid Component
 * Grid of 3 stat cards (Streak/Entries/Words)
 */

import React from 'react';
import { View } from 'react-native';

import { StatCard } from './StatCard';

interface StatCardsGridProps {
    streak: number | string;
    entries: number;
    words: number;
    onStreakPress?: () => void;
    onEntriesPress?: () => void;
    onWordsPress?: () => void;
}

export function StatCardsGrid({
    streak,
    entries,
    words,
    onStreakPress,
    onEntriesPress,
    onWordsPress,
}: StatCardsGridProps) {
    const displayStreak = streak === 0 ? '—' : streak;

    return (
        <View className="flex-row gap-3">
            <View className="flex-1">
                <StatCard
                    label="Streak"
                    value={displayStreak}
                    onPress={onStreakPress}
                    accessibilityLabel={`Streak: ${streak} days`}
                />
            </View>
            <View className="flex-1">
                <StatCard
                    label="Entries"
                    value={entries}
                    onPress={onEntriesPress}
                    accessibilityLabel={`Total entries: ${entries}`}
                />
            </View>
            <View className="flex-1">
                <StatCard
                    label="Words"
                    value={words}
                    onPress={onWordsPress}
                    accessibilityLabel={`Total words: ${words}`}
                />
            </View>
        </View>
    );
}
