/**
 * What the writer's own day feelings add up to (Kaneo #99).
 *
 * Renders nothing at all until there is something to say. A card that shows
 * "0 days" every morning teaches people to ignore it.
 */
import React from 'react';
import { Text, View } from 'react-native';

import { useDayMoodInsight } from '@/hooks/insights/useDayMoodInsight';
import { SIDE_LABELS, sideSummary } from '@/utils/dayMoodInsights';

const heading = 'text-[13px] tracking-[0.4px] text-text-secondary-light dark:text-text-secondary-dark';
const body = 'text-[15px] leading-6 text-text-light dark:text-text-dark';
const lean = 'text-[15px] leading-6 text-text-light dark:text-text-dark';
const columnLabel = 'text-[12px] tracking-[0.4px] text-text-secondary-light dark:text-text-secondary-dark';
const columnBody = 'text-[13px] leading-5 text-text-light dark:text-text-dark';

export function DayMoodCard() {
    const insight = useDayMoodInsight();
    if (!insight.hasAnything) return null;

    return (
        <View
            testID="day-mood-card"
            className="gap-3 rounded-card border border-hairline-light bg-surface-light px-5 py-4 dark:border-hairline-dark dark:bg-surface-dark"
        >
            <Text className={heading}>How your days have felt</Text>

            {insight.leanLine ? (
                <Text testID="day-mood-lean" className={lean}>{insight.leanLine}</Text>
            ) : (
                <Text className={body}>
                    {insight.recordedDays === 1
                        ? 'One day so far. A pattern needs a few more.'
                        : insight.recordedDays + ' days so far. A pattern needs a few more.'}
                </Text>
            )}

            <View className="flex-row gap-4">
                <View className="flex-1 gap-1">
                    <Text className={columnLabel}>{SIDE_LABELS.lighter.toUpperCase()}</Text>
                    <Text testID="day-mood-lighter" className={columnBody}>{sideSummary(insight.lighter)}</Text>
                </View>
                <View className="flex-1 gap-1">
                    <Text className={columnLabel}>{SIDE_LABELS.heavier.toUpperCase()}</Text>
                    <Text testID="day-mood-heavier" className={columnBody}>{sideSummary(insight.heavier)}</Text>
                </View>
            </View>
        </View>
    );
}
