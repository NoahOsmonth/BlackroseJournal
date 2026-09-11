/**
 * A single ritual row on Today: label on the left, state on the right, one
 * hairline between rows. These rows sit inside ONE bordered container (owned by
 * the screen) so the pair reads as a quiet list — matching black-rose-quiet-today.png.
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface TodayRitualRowProps {
    /** Row label, e.g. "Morning note". */
    title: string;
    /** Shown on the right when the ritual is still open, e.g. "Open". */
    openLabel?: string;
    onPress?: () => void;
    isCompleted?: boolean;
    /** Trailing hairline; off for the last row in a group. */
    showDivider?: boolean;
    testID?: string;
}

export function TodayRitualRow({
    title,
    openLabel = 'Open',
    onPress,
    isCompleted = false,
    showDivider = true,
    testID,
}: TodayRitualRowProps) {
    return (
        <View>
            <Pressable
                onPress={onPress}
                className="flex-row items-center justify-between px-4 py-5"
                accessibilityLabel={title}
                accessibilityRole="button"
                accessibilityState={{ disabled: !onPress }}
                testID={testID}
            >
                <Text className="text-[16px] text-text-light dark:text-text-dark">
                    {title}
                </Text>
                <Text className="text-[14px] text-text-secondary-light dark:text-text-secondary-dark">
                    {isCompleted ? 'Done' : openLabel}
                </Text>
            </Pressable>
            {showDivider ? (
                <View
                    className="mx-4 h-px bg-hairline-light dark:bg-hairline-dark"
                    testID={testID ? `${testID}-divider` : undefined}
                />
            ) : null}
        </View>
    );
}

