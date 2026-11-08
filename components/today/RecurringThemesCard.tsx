import React from 'react';
import { Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { describeWeekCount, type RecurringTheme } from '@/utils/recurringThemes';

interface RecurringThemesCardProps {
    themes: readonly RecurringTheme[];
    /** True when too few weeks have been written to spot a pattern. */
    needsMoreWeeks: boolean;
    weekCount: number;
    /** The weekly summaries could not be read at all. */
    isUnavailable: boolean;
}

/**
 * Themes that keep coming back across weeks (Kaneo #25).
 *
 * Scrolling a year of entries shows you days; this shows you what recurs. The
 * count is stated plainly next to each theme so the pattern is checkable, not
 * a claim the app makes about you.
 */
export function RecurringThemesCard({ themes, needsMoreWeeks, weekCount, isUnavailable }: RecurringThemesCardProps) {
    const isDark = useColorScheme() === 'dark';
    const iconColor = isDark ? '#B8AFA4' : '#6B6560';

    return (
        <View
            testID="recurring-themes-card"
            className="rounded-card border border-hairline-light bg-surface-light px-5 py-5 dark:border-hairline-dark dark:bg-surface-dark"
        >
            <View className="flex-row items-center gap-2">
                <MaterialIcons name="repeat" size={18} color={iconColor} />
                <Text className="text-[13px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark">
                    Keeps coming back
                </Text>
            </View>

            {isUnavailable && (
                <Text className="mt-3 text-[15px] leading-[23px] text-text-light dark:text-text-dark">
                    Your weekly summaries could not be opened just now. They are not lost — try again in a moment.
                </Text>
            )}

            {needsMoreWeeks && (
                <Text className="mt-3 text-[15px] leading-[23px] text-text-light dark:text-text-dark">
                    {weekCount === 0
                        ? 'Write for a few more weeks and the things that keep returning will show up here.'
                        : `Written ${describeWeekCount(weekCount)} so far. A few more and the things that keep returning will show up here.`}
                </Text>
            )}

            {!isUnavailable && !needsMoreWeeks && themes.length === 0 && (
                <Text className="mt-3 text-[15px] leading-[23px] text-text-light dark:text-text-dark">
                    Nothing has come back across weeks yet. That is not a problem — some seasons are wide.
                </Text>
            )}

            {themes.length > 0 && (
                <View className="mt-4 gap-3">
                    {themes.map((theme) => (
                        <View key={theme.topic} className="flex-row items-baseline justify-between gap-3">
                            <Text
                                className="flex-1 text-[17px] leading-[24px] text-text-light dark:text-text-dark"
                                style={{ fontFamily: 'PlayfairDisplayRegular' }}
                            >
                                {theme.topic}
                            </Text>
                            <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                                {describeWeekCount(theme.weekCount)}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}
