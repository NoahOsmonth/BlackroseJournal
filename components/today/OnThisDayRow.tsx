/**
 * OnThisDayRow — one quiet line of memory on Today: the writer's own entry
 * from this date in an earlier year. Sits as a prose row under the rituals,
 * between two hairlines, with the years as the label and their first words as
 * the line. Renders nothing when there is no earlier year to return to.
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { SectionLabel } from '@/components/ui/SectionLabel';
import type { OnThisDayEntry, OnThisDayPick } from '@/utils/onThisDay';

/** A memory to show: the saved entry plus the id needed to open it. */
export type OnThisDayMemory = OnThisDayEntry & { sourceId: string };

interface OnThisDayRowProps {
    pick: OnThisDayPick<OnThisDayMemory> | null;
    onPress: (sourceId: string, type: 'journal' | 'checkin') => void;
    /** Opens the full view with every past year, not just this one memory. */
    onSeeAll?: () => void;
}

export function OnThisDayRow({ pick, onPress, onSeeAll }: OnThisDayRowProps) {
    if (!pick) return null;

    const { entry, label } = pick;
    const type = entry.id.startsWith('checkin-') ? 'checkin' : 'journal';

    return (
        <View className="gap-2">
            <SectionLabel
                action={onSeeAll ? (
                    <Pressable
                        onPress={onSeeAll}
                        accessibilityRole="button"
                        accessibilityLabel="See all years"
                        testID="see-on-this-day"
                        className="min-h-11 justify-center px-2"
                    >
                        <Text className="text-[12px] text-text-secondary-light dark:text-text-secondary-dark">
                            See all years
                        </Text>
                    </Pressable>
                ) : undefined}
            >
                {label}
            </SectionLabel>
            <View className="overflow-hidden rounded-card border border-hairline-light dark:border-hairline-dark">
                <Pressable
                    onPress={() => onPress(entry.sourceId, type)}
                    className="px-4 py-4"
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${entry.title}`}
                    testID="today-on-this-day"
                >
                    <Text
                        className="text-[16px] text-text-light dark:text-text-dark"
                        numberOfLines={1}
                    >
                        {entry.title}
                    </Text>
                    <Text
                        className="mt-1 text-[14px] text-text-secondary-light dark:text-text-secondary-dark"
                        numberOfLines={2}
                    >
                        {entry.summary}
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}
