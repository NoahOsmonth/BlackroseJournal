/**
 * A third, quiet filter row in the Archive: browse by the days you wrote.
 * Pure rendering — the screen owns the narrowed sections and the active day.
 * Mirrors MoodChipRow so all three chip rows share one geometry and palette.
 */
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { SCREEN_PADDING_X } from '@/constants/spacing';
import type { WrittenDayChip } from '@/utils/writtenDays';

interface WrittenDaysRowProps {
    readonly chips: readonly WrittenDayChip[];
    readonly activeDay: string;
    readonly onSelect: (dateKey: string) => void;
}

const chipBase = 'min-h-11 justify-center rounded-full border px-4 ';
const chipOn = 'border-accent-green bg-surface-light dark:border-accent-green-dark dark:bg-surface-dark';
const chipOff = 'border-hairline-light bg-background-light dark:border-hairline-dark dark:bg-background-dark';
const labelClass = 'text-[14px] text-text-light dark:text-text-dark';

export function WrittenDaysRow({ chips, activeDay, onSelect }: WrittenDaysRowProps) {
    if (chips.length === 0) return null;
    const allSelected = activeDay.trim().length === 0;

    return (
        <View className="pb-1 pt-1" testID="archive-written-days-row">
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING_X, gap: 8 }}
                accessibilityLabel="Browse by day"
            >
                <Pressable
                    onPress={() => onSelect('')}
                    accessibilityRole="button"
                    accessibilityLabel="Show every day"
                    accessibilityState={{ selected: allSelected }}
                    testID="written-day-all"
                    className={chipBase + (allSelected ? chipOn : chipOff)}
                >
                    <Text className={labelClass}>All days</Text>
                </Pressable>
                {chips.map((chip) => {
                    const selected = activeDay === chip.dateKey;
                    const count = chip.itemCount;
                    return (
                        <Pressable
                            key={chip.dateKey}
                            onPress={() => onSelect(selected ? '' : chip.dateKey)}
                            accessibilityRole="button"
                            accessibilityLabel={`Read what you wrote on ${chip.label}`}
                            accessibilityState={{ selected }}
                            testID={`written-day-${chip.dateKey}`}
                            className={chipBase + (selected ? chipOn : chipOff)}
                        >
                            <Text className={labelClass}>
                                {chip.shortLabel} · {count} {count === 1 ? 'entry' : 'entries'}
                            </Text>
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
}
