/**
 * What the writer's own day feelings add up to (Kaneo #99, lens added in #103).
 *
 * Renders nothing at all until there is something to say. A card that shows
 * "0 days" every morning teaches people to ignore it.
 *
 * The lens is a view choice, not a saved setting: switching it re-counts through
 * the same pure function, so the evidence rules cannot differ between lenses.
 */
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useDayMoodDays } from '@/hooks/insights/useDayMoodDays';
import { useDayMoodInsight } from '@/hooks/insights/useDayMoodInsight';
import { DayMoodStrip } from './DayMoodStrip';
import {
    INSIGHT_WINDOW_DAYS,
    INSIGHT_WINDOWS,
    insightWindow,
    SIDE_LABELS,
    sideSummary,
} from '@/utils/dayMoodInsights';

const heading = 'text-[13px] tracking-[0.4px] text-text-secondary-light dark:text-text-secondary-dark';
const body = 'text-[15px] leading-6 text-text-light dark:text-text-dark';
const lean = 'text-[15px] leading-6 text-text-light dark:text-text-dark';
const columnLabel = 'text-[12px] tracking-[0.4px] text-text-secondary-light dark:text-text-secondary-dark';
const columnBody = 'text-[13px] leading-5 text-text-light dark:text-text-dark';

const lensBase = 'min-h-11 justify-center rounded-full border px-4 ';
const lensOn = 'border-accent-green bg-surface-light dark:border-accent-green-dark dark:bg-surface-dark';
const lensOff = 'border-hairline-light bg-background-light dark:border-hairline-dark dark:bg-background-dark';
const lensLabelOn = 'text-[13px] text-text-light dark:text-text-dark';
const lensLabelOff = 'text-[13px] text-text-secondary-light dark:text-text-secondary-dark';

export function DayMoodCard() {
    const [windowDays, setWindowDays] = useState<number>(INSIGHT_WINDOW_DAYS);
    const days = useDayMoodDays();
    const insight = useDayMoodInsight(days, windowDays);
    if (!insight.hasAnything) return null;

    const lens = insightWindow(windowDays);

    return (
        <View
            testID="day-mood-card"
            className="gap-3 rounded-card border border-hairline-light bg-surface-light px-5 py-4 dark:border-hairline-dark dark:bg-surface-dark"
        >
            <Text className={heading}>How your days have felt</Text>
            <Text testID="day-mood-period" className={columnLabel}>
                Looking at {lens.sentence}
            </Text>

            <DayMoodStrip days={days} />

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

            <View className="flex-row gap-2" accessibilityRole="tablist">
                {INSIGHT_WINDOWS.map((option) => {
                    const selected = option.days === windowDays;
                    return (
                        <Pressable
                            key={option.days}
                            onPress={() => setWindowDays(option.days)}
                            accessibilityRole="tab"
                            accessibilityLabel={option.label}
                            aria-selected={selected}
                            testID={'day-mood-lens-' + option.days}
                            className={lensBase + (selected ? lensOn : lensOff)}
                        >
                            <Text className={selected ? lensLabelOn : lensLabelOff}>{option.label}</Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}
