import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface HistoryEmptyProps {
    hasAnyItems: boolean;
    isSearching: boolean;
    onWritePress: () => void;
}

/**
 * Archive empty state. Two cases only: nothing written yet, or a search that
 * matched nothing. The CTA is a quiet outline button — no filled brand orange.
 */
export function HistoryEmpty({ hasAnyItems, isSearching, onWritePress }: HistoryEmptyProps) {
    const title = isSearching
        ? 'Nothing found'
        : hasAnyItems
            ? 'No entries here'
            : 'Nothing written yet';

    const message = isSearching
        ? 'Try a different word, or clear the search to see every entry.'
        : 'Finished journal entries and check-ins will live here as a quiet ledger of your days.';

    return (
        <View
            className="items-center px-6 py-12"
            accessibilityLabel={`${title}. ${message}`}
        >
            <Text
                className="text-center text-[22px] text-text-light dark:text-text-dark"
                style={{ fontFamily: 'PlayfairDisplayRegular' }}
            >
                {title}
            </Text>
            <Text className="mt-2 max-w-xs text-center text-sm leading-relaxed text-text-secondary-light dark:text-text-secondary-dark">
                {message}
            </Text>
            {!isSearching ? (
                <Pressable
                    onPress={onWritePress}
                    className="mt-6 rounded-control border border-hairline-light px-5 py-2.5 dark:border-hairline-dark"
                    accessibilityRole="button"
                    accessibilityLabel="Write an entry"
                    style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                >
                    <Text className="text-sm text-text-light dark:text-text-dark">
                        Write an entry
                    </Text>
                </Pressable>
            ) : null}
        </View>
    );
}
