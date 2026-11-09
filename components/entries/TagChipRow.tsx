/**
 * A quiet filter row in the Archive: browse by labels YOU chose.
 * Pure rendering plus the rename sheet it opens — the screen owns the narrowed
 * sections and the active label. Mirrors MoodChipRow for one chip geometry.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { TagRenameSheet } from '@/components/entries/TagRenameSheet';
import { SCREEN_PADDING_X } from '@/constants/spacing';
import { formatTagLabel, type TagChip } from '@/utils/entryTags';

interface TagChipRowProps {
    readonly chips: readonly TagChip[];
    readonly activeTag: string;
    readonly countFor: (label: string) => number;
    readonly onSelect: (label: string) => void;
    /** Rename the active label everywhere. The chip is hidden without it. */
    readonly onRename?: (from: string, to: string) => void;
}

const chipBase = 'min-h-11 justify-center rounded-full border px-4 ';
const chipOn = 'border-accent-green bg-surface-light dark:border-accent-green-dark dark:bg-surface-dark';
const chipOff = 'border-hairline-light bg-background-light dark:border-hairline-dark dark:bg-background-dark';
const labelClass = 'text-[14px] text-text-light dark:text-text-dark';

export function TagChipRow({ chips, activeTag, countFor, onSelect, onRename }: TagChipRowProps) {
    const [renaming, setRenaming] = useState(false);
    if (chips.length === 0) return null;
    const allSelected = activeTag.trim().length === 0;
    const canRename = Boolean(onRename) && !allSelected;

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
                {canRename ? (
                    <Pressable
                        onPress={() => setRenaming(true)}
                        accessibilityRole="button"
                        accessibilityLabel={`Rename ${formatTagLabel(activeTag)}`}
                        testID="tag-chip-rename"
                        className={chipBase + chipOff}
                    >
                        <Text className={labelClass}>Rename</Text>
                    </Pressable>
                ) : null}
            </ScrollView>
            {onRename ? (
                <TagRenameSheet
                    visible={renaming}
                    current={activeTag}
                    onCancel={() => setRenaming(false)}
                    onSubmit={(next) => {
                        onRename(activeTag, next);
                        setRenaming(false);
                    }}
                />
            ) : null}
        </View>
    );
}
