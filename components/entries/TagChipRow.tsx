/**
 * A quiet filter row in the Archive: browse by labels YOU chose.
 * Pure rendering — the screen owns the narrowed sections and the active label.
 * Mirrors MoodChipRow so every chip row shares one geometry and palette.
 */
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { SCREEN_PADDING_X } from '@/constants/spacing';
import { formatTagLabel, type TagChip } from '@/utils/entryTags';

interface TagChipRowProps {
    readonly chips: readonly TagChip[];
    readonly activeTag: string;
    readonly countFor: (label: string) => number;
    readonly onSelect: (label: string) => void;
}

const chipBase = 'min-h-11 justify-center rounded-full border px-4 ';
const chipOn = 'border-accent-green bg-surface-light dark:border-accent-green-dark dark:bg-surface-dark';
const chipOff = 'border-hairline-light bg-background-light dark:border-hairline-dark dark:bg-background-dark';
const labelClass = 'text-[14px] text-text-light dark:text-text-dark';

export function TagChipRow({ chips, activeTag, countFor, onSelect }: TagChipRowProps) {
    if (chips.length === 0) return null;
    const allSelected = activeTag.trim().length === 0;

    return (
        <View className="pb-1 pt-1" testID="archive-tag-row">
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING_X, gap: 8 }}
                accessibilityLabel="Browse by your labels"
            >
                <Pressable
                    onPress={() => onSelect('')}
                    accessibilityRole="button"
                    accessibilityLabel="Show every label"
                    accessibilityState={{ selected: allSelected }}
                    testID="tag-chip-all"
                    className={chipBase + (allSelected ? chipOn : chipOff)}
                >
                    <Text className={labelClass}>All</Text>
                </Pressable>
                {chips.map((chip) => {
                    const selected = activeTag === chip.label;
                    const shown = countFor(chip.label);
                    const label = formatTagLabel(chip.label);
                    return (
                        <Pressable
                            key={chip.label}
                            onPress={() => onSelect(selected ? '' : chip.label)}
                            accessibilityRole="button"
                            accessibilityLabel={`Label ${label}, ${shown} ${shown === 1 ? 'entry' : 'entries'}`}
                            accessibilityState={{ selected }}
                            testID={`tag-chip-${chip.label}`}
                            className={chipBase + (selected ? chipOn : chipOff)}
                        >
                            <Text className={labelClass}>{label} · {shown}</Text>
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
}
