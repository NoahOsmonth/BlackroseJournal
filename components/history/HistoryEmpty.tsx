import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { HistoryFilter } from '@/hooks/history/historyUtils';

interface HistoryEmptyProps {
    filter: HistoryFilter;
    hasAnyItems: boolean;
    onWritePress: () => void;
}

function copyFor(filter: HistoryFilter, hasAnyItems: boolean): {
    title: string;
    message: string;
    showCta: boolean;
} {
    if (!hasAnyItems) {
        return {
            title: 'Nothing written yet',
            message: 'Finished journal entries and check-ins will live here as a quiet ledger of your days.',
            showCta: true,
        };
    }
    if (filter === 'journal') {
        return {
            title: 'No journal entries',
            message: 'Journal sessions will appear here once you finish one.',
            showCta: true,
        };
    }
    if (filter === 'ritual') {
        return {
            title: 'No rituals yet',
            message: 'Morning, evening, and intention check-ins show up when you complete them.',
            showCta: false,
        };
    }
    return {
        title: 'Nothing here',
        message: 'Try another filter, or write something new.',
        showCta: true,
    };
}

export function HistoryEmpty({ filter, hasAnyItems, onWritePress }: HistoryEmptyProps) {
    const { title, message, showCta } = copyFor(filter, hasAnyItems);

    return (
        <View
            className="items-center px-6 py-12"
            accessibilityLabel={`${title}. ${message}`}
        >
            <Text
                className="text-center text-2xl font-bold text-text-light dark:text-text-dark"
                style={{ fontFamily: 'PlayfairDisplayBold' }}
            >
                {title}
            </Text>
            <Text className="mt-2 max-w-xs text-center text-sm leading-relaxed text-text-secondary-light dark:text-text-secondary-dark">
                {message}
            </Text>
            {showCta ? (
                <Pressable
                    onPress={onWritePress}
                    className="mt-6 rounded-full bg-primary px-5 py-2.5 dark:bg-primary-dark"
                    accessibilityRole="button"
                    accessibilityLabel="Write an entry"
                    style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
                >
                    <Text className="text-sm font-bold text-white dark:text-gray-900">
                        Write an entry
                    </Text>
                </Pressable>
            ) : null}
        </View>
    );
}
