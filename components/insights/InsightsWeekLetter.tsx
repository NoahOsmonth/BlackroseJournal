import React from 'react';
import { Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { BLACKROSE_PALETTE } from '@/constants/theme';

const UNLOCK_AT = 5;

interface InsightsWeekLetterProps {
    isUnlocked: boolean;
    entriesCount: number;
    weeklySummary?: string;
    /** Kept for call-site compatibility; the locked card carries no link. */
    onWritePress?: () => void;
}

export function InsightsWeekLetter({
    isUnlocked,
    entriesCount,
    weeklySummary,
}: InsightsWeekLetterProps) {
    const isDark = useColorScheme() === 'dark';
    const remaining = Math.max(0, UNLOCK_AT - entriesCount);
    const summary = weeklySummary?.trim() ?? '';
    const hasLetter = isUnlocked
        && summary.length > 0
        && summary !== 'No entries yet this week.';

    if (hasLetter) {
        return (
            <View
                className="rounded-card border border-hairline-light dark:border-hairline-dark bg-surface-light dark:bg-surface-dark px-5 py-5"
                accessibilityLabel="This week's letter"
            >
                <Text className="text-[12px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark">
                    This week&apos;s letter
                </Text>
                <Text
                    className="mt-3 text-[16px] leading-7 text-text-light dark:text-text-dark"
                    style={{ fontFamily: 'PlayfairDisplayRegular' }}
                >
                    {summary}
                </Text>
            </View>
        );
    }

    return (
        <View
            className="rounded-card border border-hairline-light dark:border-hairline-dark bg-surface-light dark:bg-surface-dark px-5 py-6"
            accessibilityLabel={`This week's letter locked. ${entriesCount} of ${UNLOCK_AT} entries.`}
        >
            <Text
                className="text-[18px] text-text-light dark:text-text-dark"
                style={{ fontFamily: 'PlayfairDisplayRegular' }}
            >
                Weekly report
            </Text>

            {/* Lock + honest headline: the unlock is entry-count based, so the
                card never promises a weekday it cannot guarantee. */}
            <View className="mt-4 flex-row items-start gap-3">
                <MaterialIcons
                    name="lock-outline"
                    size={28}
                    color={isDark ? BLACKROSE_PALETTE.dark.accent : BLACKROSE_PALETTE.light.accent}
                />
                <View className="flex-1">
                    <Text className="text-[16px] text-text-light dark:text-text-dark">
                        {entriesCount >= UNLOCK_AT
                            ? 'Unlocking'
                            : `Unlocks with ${remaining} more ${remaining === 1 ? 'entry' : 'entries'}`}
                    </Text>
                    <Text className="mt-1 text-[14px] leading-relaxed text-text-secondary-light dark:text-text-secondary-dark">
                        Get a weekly in-depth analysis of your themes, patterns, and more.
                    </Text>
                </View>
            </View>

            {/* Concept keeps one quiet line here — no progress marks, no link. */}
            <View className="mt-5 border-t border-hairline-light dark:border-hairline-dark pt-4">
                <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                    {entriesCount >= UNLOCK_AT
                        ? 'Analysis in progress'
                        : `Requires ${remaining} more ${remaining === 1 ? 'entry' : 'entries'}`}
                </Text>
            </View>
        </View>
    );
}

export const INSIGHTS_UNLOCK_AT = UNLOCK_AT;
