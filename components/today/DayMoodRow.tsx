/**
 * "How did today feel?" plus "What shaped it?" (Kaneo #98).
 *
 * Deliberately quiet: it sits below the writing card, never asks twice, and
 * shows nothing alarming when a day goes unrecorded. Both answers are optional
 * and tapping the chosen feeling again takes it back off.
 */
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { SCREEN_PADDING_X } from '@/constants/spacing';
import { useDayMoodDays } from '@/hooks/insights/useDayMoodDays';
import { useDayMoodInsight } from '@/hooks/insights/useDayMoodInsight';
import { useDayMood } from '@/hooks/today/useDayMood';
import { DAY_FACTORS, DAY_MOODS, MAX_DAY_FACTORS } from '@/utils/dayMood';

const chipBase = 'min-h-11 justify-center rounded-full border px-4 ';
const chipOn = 'border-accent-green bg-surface-light dark:border-accent-green-dark dark:bg-surface-dark';
const chipOff = 'border-hairline-light bg-background-light dark:border-hairline-dark dark:bg-background-dark';
const labelOn = 'text-[14px] text-text-light dark:text-text-dark';
const labelOff = 'text-[14px] text-text-secondary-light dark:text-text-secondary-dark';
const heading = 'text-[13px] tracking-[0.4px] text-text-secondary-light dark:text-text-secondary-dark';

export function DayMoodRow() {
    const { moodId, factorIds, setFeeling, toggleFactor } = useDayMood();
    const insight = useDayMoodInsight(useDayMoodDays());
    const atCap = factorIds.length >= MAX_DAY_FACTORS;

    return (
        <View className="gap-2 pb-1" testID="day-mood-row">
            <Text className={heading}>How did today feel?</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING_X, gap: 8 }}
                accessibilityLabel="How did today feel"
            >
                {DAY_MOODS.map((mood) => {
                    const selected = moodId === mood.id;
                    return (
                        <Pressable
                            key={mood.id}
                            onPress={() => setFeeling(mood.id)}
                            accessibilityRole="button"
                            accessibilityLabel={mood.label}
                            // RN-Web does not map accessibilityState.selected to
                            // aria-selected on a Pressable, so the chip looks chosen
                            // but announces as a plain button. Spell it out.
                            aria-selected={selected}
                            testID={'day-mood-' + mood.id}
                            className={chipBase + (selected ? chipOn : chipOff)}
                        >
                            <Text className={selected ? labelOn : labelOff}>{mood.label}</Text>
                        </Pressable>
                    );
                })}
            </ScrollView>

            {moodId ? (
                <View className="gap-2">
                    <Text className={heading}>What shaped it?</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING_X, gap: 8 }}
                        accessibilityLabel="What shaped it"
                    >
                        {DAY_FACTORS.map((factor) => {
                            const selected = factorIds.includes(factor.id);
                            const refused = !selected && atCap;
                            return (
                                <Pressable
                                    key={factor.id}
                                    onPress={() => toggleFactor(factor.id)}
                                    disabled={refused}
                                    accessibilityRole="button"
                                    accessibilityLabel={factor.label}
                                    aria-selected={selected}
                                    accessibilityState={{ disabled: refused }}
                                    testID={'day-factor-' + factor.id}
                                    className={chipBase + (selected ? chipOn : chipOff) + (refused ? ' opacity-40' : '')}
                                >
                                    <Text className={selected ? labelOn : labelOff}>{factor.label}</Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                    {atCap ? (
                        <Text
                            testID="day-mood-cap"
                            className="px-6 text-[12px] text-text-secondary-light dark:text-text-secondary-dark"
                        >
                            Six is the most a day can hold. Take one off to add another.
                        </Text>
                    ) : null}
                </View>
            ) : null}

            {/* The same sentence Insights shows, where the day is recorded. Sits
                below the chips so a line appearing can never move one under the
                finger that just tapped it. */}
            {insight.leanLine ? (
                <Text
                    testID="day-mood-lean-line"
                    className="px-6 pt-1 text-[12px] leading-5 text-text-secondary-light dark:text-text-secondary-dark"
                >
                    {insight.leanLine}
                </Text>
            ) : null}
        </View>
    );
}
