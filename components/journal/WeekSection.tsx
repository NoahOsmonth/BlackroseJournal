/**
 * Week Section Component
 * Groups journal entries by week with date range header
 * Matches journal-history.html design
 */

import { JournalEntry } from '@/services/journalStorage.types';
import React from 'react';
import { Text, View } from 'react-native';
import { EntryCard } from './EntryCard';

interface WeekSectionProps {
    dateRange: string;
    entries: JournalEntry[];
    onEntryPress?: (entry: JournalEntry) => void;
}

function getDayAbbrev(timestamp: number): string {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[new Date(timestamp).getDay()];
}

export function WeekSection({ dateRange, entries, onEntryPress }: WeekSectionProps) {
    return (
        <View className="mb-6">
            <Text className="text-xs font-semibold text-subtext-light dark:text-subtext-dark uppercase tracking-wide mb-2 pl-1">
                {dateRange}
            </Text>
            <View className="bg-surface-light dark:bg-surface-dark rounded-xl border border-divider-light dark:border-divider-dark overflow-hidden shadow-soft">
                {entries.map((entry, index) => (
                    <View key={entry.id}>
                        {index > 0 && (
                            <View className="h-px bg-divider-light dark:bg-divider-dark" />
                        )}
                        <EntryCard
                            day={getDayAbbrev(entry.createdAt)}
                            emoji={entry.emoji}
                            title={entry.title}
                            onPress={() => onEntryPress?.(entry)}
                        />
                    </View>
                ))}
            </View>
        </View>
    );
}
