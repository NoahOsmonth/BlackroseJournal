import React from 'react';
import { Pressable, Text, View } from 'react-native';

import {
    describeDayKey,
    monthGrid,
    monthLabel,
    quickChoices,
    upcomingMonths,
} from '@/utils/unlockDate';

interface UnlockDatePickerProps {
    /** Today as a day key, supplied by the screen so the picker never reads the clock. */
    todayKey: string;
    value: string;
    onChange: (dayKey: string) => void;
}

const CHIP = 'min-h-[44px] justify-center rounded-full border px-4';
const CHIP_ON = 'border-hairline-light dark:border-hairline-dark bg-bone-light dark:bg-bone-dark';
const CHIP_OFF = 'border-hairline-light dark:border-hairline-dark';

/**
 * Choose when a letter opens (Kaneo #51).
 *
 * Quick choices for the common cases, then a month grid for anything else.
 * Days already gone are shown but not selectable — hiding them would make the
 * calendar look broken rather than honest.
 */
export function UnlockDatePicker({ todayKey, value, onChange }: UnlockDatePickerProps) {
    const months = upcomingMonths(todayKey, 6);
    const quick = quickChoices(todayKey);

    return (
        <View testID="unlock-date-picker" className="gap-4">
            <View className="flex-row flex-wrap gap-2">
                {quick.map((choice) => {
                    const isSelected = choice.dayKey === value;
                    return (
                        <Pressable
                            key={choice.id}
                            onPress={() => onChange(choice.dayKey)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                            accessibilityLabel={`Open ${choice.label.toLowerCase()}, on ${describeDayKey(choice.dayKey)}`}
                            className={`${CHIP} ${isSelected ? CHIP_ON : CHIP_OFF}`}
                        >
                            <Text className="text-[13px] text-text-light dark:text-text-dark">{choice.label}</Text>
                        </Pressable>
                    );
                })}
            </View>

            {months.map((month) => {
                const cells = monthGrid(month.year, month.monthIndex, todayKey);
                return (
                    <View key={`${month.year}-${month.monthIndex}`} className="gap-2">
                        <Text className="text-[11px] uppercase tracking-[1.6px] text-text-secondary-light dark:text-text-secondary-dark">
                            {monthLabel(month.year, month.monthIndex)}
                        </Text>
                        <View className="flex-row flex-wrap">
                            {cells.map((cell, index) => {
                                if (cell.dayKey === '') {
                                    return <View key={`blank-${index}`} style={{ width: '14.28%', height: 44 }} />;
                                }
                                const isSelected = cell.dayKey === value;
                                return (
                                    <Pressable
                                        key={cell.dayKey}
                                        onPress={() => onChange(cell.dayKey)}
                                        disabled={cell.isPast}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: isSelected, disabled: cell.isPast }}
                                        accessibilityLabel={describeDayKey(cell.dayKey)}
                                        style={{ width: '14.28%', height: 44 }}
                                        className="items-center justify-center"
                                    >
                                        <View
                                            className={`h-[36px] w-[36px] items-center justify-center rounded-full ${isSelected ? 'bg-bone-light dark:bg-bone-dark' : ''}`}
                                        >
                                            <Text
                                                className={`text-[14px] ${
                                                    cell.isPast
                                                        ? 'text-text-secondary-light dark:text-text-secondary-dark opacity-40'
                                                        : 'text-text-light dark:text-text-dark'
                                                }`}
                                            >
                                                {cell.dayOfMonth}
                                            </Text>
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                );
            })}

            <Text accessibilityLabel="Chosen day" className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                Opens on {describeDayKey(value)}
            </Text>
        </View>
    );
}
