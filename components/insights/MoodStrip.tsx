/**
 * MoodStrip — a quiet seven-day line of feeling on Insights.
 *
 * One cell per day of the current week, oldest first. A written day shows its
 * plain mood word; a day with no writing stays an empty hairline cell, so the
 * strip never reads a silent day as a bad one. Weekday captions under each
 * cell, and the whole week collapses to one sentence when nothing is written.
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { SectionLabel } from '@/components/ui/SectionLabel';
import { MoodDayCell, formatMoodDayLabel } from '@/utils/moodStrip';

interface MoodStripProps {
    cells: MoodDayCell[];
    onSelectDay?: (cell: MoodDayCell) => void;
}

const HAIRLINE = 'border-hairline-light dark:border-hairline-dark';
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function dayLetter(dateKey: string): string {
    const [year, month, day] = dateKey.split('-').map(Number);
    return DAY_LETTERS[new Date(year, (month ?? 1) - 1, day ?? 1).getDay()];
}

export function MoodStrip({ cells, onSelectDay }: MoodStripProps) {
    const writtenDays = cells.filter((cell) => cell.mood !== null).length;
    const hasAnyWriting = cells.some((cell) => cell.hasWriting);

    if (!hasAnyWriting) {
        return (
            <View className="gap-2">
                <SectionLabel>This week</SectionLabel>
                <View className={`rounded-card border ${HAIRLINE} px-5 py-5`}>
                    <Text className="text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
                        Your moods appear here after a few days of writing.
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View className="gap-2">
            <SectionLabel>This week</SectionLabel>
            <View className={`rounded-card border ${HAIRLINE} px-3 py-4`}>
                <View className="flex-row gap-1">
                    {cells.map((cell) => (
                        <Pressable
                            key={cell.dateKey}
                            className="flex-1 items-center gap-2"
                            onPress={onSelectDay ? () => onSelectDay(cell) : undefined}
                            accessibilityRole="button"
                            accessibilityLabel={
                                cell.mood
                                    ? `${formatMoodDayLabel(cell, cells)}: ${cell.mood}`
                                    : `${formatMoodDayLabel(cell, cells)}: no writing`
                            }
                            testID={`mood-day-${cell.dateKey}`}
                        >
                            <Text
                                className="text-[10px] uppercase tracking-[1px] text-text-secondary-light dark:text-text-secondary-dark"
                                numberOfLines={1}
                            >
                                {dayLetter(cell.dateKey)}
                            </Text>
                            <View
                                className={
                                    cell.mood
                                        ? 'h-16 w-full items-center justify-center rounded-control bg-surface-light dark:bg-surface-dark'
                                        : `h-16 w-full items-center justify-center rounded-control border ${HAIRLINE}`
                                }
                            >
                                <Text
                                    className="px-1 text-center text-[11px] text-text-light dark:text-text-dark"
                                    numberOfLines={2}
                                >
                                    {cell.mood ?? ''}
                                </Text>
                            </View>
                        </Pressable>
                    ))}
                </View>
                <Text className="mt-3 text-[12px] text-text-secondary-light dark:text-text-secondary-dark">
                    {writtenDays === 0
                        ? 'No moods recorded this week yet.'
                        : `${writtenDays} of 7 days have a mood.`}
                </Text>
            </View>
        </View>
    );
}
