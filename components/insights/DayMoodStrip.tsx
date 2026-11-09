/**
 * The last thirty days as a quiet strip (Kaneo #104).
 *
 * One thin bar per day, oldest on the left, tone on a single lighter -> heavier
 * ramp. A day with nothing recorded keeps its slot as an outline: a gap is
 * information, and dropping it would make a month look shorter than it is.
 *
 * Never colour-only. Every bar carries its own words, so the strip still says
 * something with the screen reader on.
 */
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import { DayMood } from '@/services/journal/dayMood';
import { getLocalDateKey } from '@/utils/date';
import { buildMoodStrip, recordedCells } from '@/utils/dayMoodStrip';

const FILL = [
    '',
    'bg-mood-1-light dark:bg-mood-1-dark',
    'bg-mood-2-light dark:bg-mood-2-dark',
    'bg-mood-3-light dark:bg-mood-3-dark',
    'bg-mood-4-light dark:bg-mood-4-dark',
    'bg-mood-5-light dark:bg-mood-5-dark',
];

const bar = 'h-7 w-2 rounded-full ';
// A gap must not be mistaken for the palest feeling. Tone alone cannot carry that
// in the light scheme, where the first ramp step sits close to the hairline, so a
// gap is also fainter: solid fill vs faint outline.
const barEmpty = 'border border-hairline-light bg-transparent opacity-40 dark:border-hairline-dark';
const caption = 'text-[11px] tracking-[0.4px] text-text-secondary-light dark:text-text-secondary-dark';

export function DayMoodStrip({ days }: { days: Record<string, DayMood> }) {
    const cells = useMemo(() => buildMoodStrip(days, getLocalDateKey()), [days]);
    if (recordedCells(cells) === 0) return null;

    return (
        <View className="gap-2" testID="day-mood-strip">
            <View className="flex-row items-end gap-1">
                {cells.map((cell) => (
                    <View
                        key={cell.dateKey}
                        testID={'day-mood-strip-' + cell.dateKey}
                        accessible
                        accessibilityRole="image"
                        accessibilityLabel={cell.label}
                        className={cell.step === null ? bar + barEmpty : bar + FILL[cell.step]}
                    />
                ))}
            </View>
            <View className="flex-row justify-between">
                <Text className={caption}>Lighter</Text>
                <Text className={caption}>Heavier</Text>
            </View>
        </View>
    );
}
