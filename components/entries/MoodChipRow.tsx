/**
 * A second, quieter filter row in the Archive: browse by how an entry felt.
 * Pure rendering — the screen owns the narrowed sections and the active mood.
 */
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { SCREEN_PADDING_X } from '@/constants/spacing';
import type { MoodChip } from '@/utils/moodChips';

interface MoodChipRowProps {
    readonly chips: readonly MoodChip[];
    readonly activeMood: string;
    readonly countFor: (label: string) => number;
    readonly onSelect: (label: string) => void;
}

const chipBase = 'min-h-11 justify-center rounded-full border px-4 ';
const chipOn = 'border-accent-green bg-surface-light dark:border-accent-green-dark dark:bg-surface-dark';
const chipOff = 'border-hairline-light bg-background-light dark:border-hairline-dark dark:bg-background-dark';
const labelClass = 'text-[14px] text-text-light dark:text-text-dark';

export function MoodChipRow({ chips, activeMood, countFor, onSelect }: MoodChipRowProps) {
    if (chips.length === 0) return null;
    const allSelected = activeMood.trim().length === 0;

    return (
        <View className="pb-1 pt-1" testID="archive-mood-row">
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING_X, gap: 8 }}
                accessibilityLabel="Browse by feeling"
            >
                <Pressable
                    onPress={() => onSelect('')}
                    accessibilityRole="button"
                    accessibilityLabel="Show every feeling"
                    accessibilityState={{ selected: allSelected }}
                    testID="mood-chip-all"
                    className={chipBase + (allSelected ? chipOn : chipOff)}
                >
                    <Text className={labelClass}>All</Text>
                </Pressable>
                {chips.map((chip) => {
                    const selected = activeMood === chip.label;
                    const shown = countFor(chip.label);
                    return (
                        <Pressable
                            key={chip.label}
                            onPress={() => onSelect(selected ? '' : chip.label)}
                            accessibilityRole="button"
                            accessibilityLabel={`Feeling ${chip.label}, ${shown} ${shown === 1 ? 'entry' : 'entries'}`}
                            accessibilityState={{ selected }}
                            testID={`mood-chip-${chip.label}`}
                            className={chipBase + (selected ? chipOn : chipOff)}
                        >
                            <Text className={labelClass}>
                                {chip.label} · {shown}
                            </Text>
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
}
