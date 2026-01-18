/**
 * Draft Card Component
 * Special card for draft entries at top of list
 * Matches journal-history.html design
 */

import { JournalEntry } from '@/services/journalStorage.types';
import React from 'react';
import { Pressable, Text } from 'react-native';

interface DraftCardProps {
    entry: JournalEntry;
    onPress?: () => void;
}

function getTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes} minutes ago`;
    if (hours < 24) return `${hours} hours ago`;
    if (days < 30) return `${days} days ago`;
    return `${Math.floor(days / 30)} months ago`;
}

export function DraftCard({ entry, onPress }: DraftCardProps) {
    return (
        <Pressable
            onPress={onPress}
            className="bg-surface-light dark:bg-surface-dark rounded-xl border border-divider-light dark:border-divider-dark p-4 shadow-soft mb-6 active:bg-gray-50 dark:active:bg-white/5"
        >
            <Text className="font-semibold text-lg text-text-light dark:text-text-dark mb-1">
                {entry.title || 'Untitled'}
            </Text>
            <Text className="text-sm text-subtext-light dark:text-subtext-dark">
                Draft • {getTimeAgo(entry.updatedAt)}
            </Text>
        </Pressable>
    );
}
