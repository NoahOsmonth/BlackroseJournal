/**
 * The bar that appears while entries are picked in the Archive. It replaces
 * nothing: it sits above the dock, says how many are picked, and offers the
 * actions that make sense — label them, take a label off, or stop picking.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';

const HAIRLINE = 'border-hairline-light dark:border-hairline-dark';
const INK = 'text-text-light dark:text-text-dark';

interface SelectionBarProps {
    readonly count: number;
    readonly onLabel: () => void;
    /** Undefined when the picked entries share no label, so there is nothing to take off. */
    readonly onRemoveLabel?: () => void;
    /**
     * True when 2+ entries are picked and they share no label. The action is
     * hidden, so without a line here one entry short of a match looks like a
     * broken button.
     */
    readonly noSharedLabel?: boolean;
    /** How many entries are on screen right now, so "all" can be exact. */
    readonly shownCount: number;
    /** True when every entry on screen is already picked. */
    readonly allPicked: boolean;
    readonly onPickAll: () => void;
    readonly onDone: () => void;
}

export function SelectionBar({
    count, onLabel, onRemoveLabel, onDone, shownCount, allPicked, onPickAll, noSharedLabel = false,
}: SelectionBarProps) {
    const picked = count === 1 ? '1 picked' : `${count} picked`;
    return (
        <View
            className={`gap-1 border-t ${HAIRLINE} bg-surface-light px-6 py-3 dark:bg-surface-dark`}
            testID="selection-bar"
        >
            {noSharedLabel ? (
                <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark" testID="selection-no-shared">
                    These entries do not share a label, so there is nothing to take off.
                </Text>
            ) : null}
            <View className="flex-row items-center gap-2">
            <Text className={`flex-1 text-[15px] ${INK}`} testID="selection-count">
                {picked}
            </Text>
            {shownCount > 1 ? (
                <Pressable
                    onPress={onPickAll}
                    accessibilityRole="button"
                    accessibilityLabel={allPicked ? 'Unpick every entry shown' : 'Pick every entry shown'}
                    accessibilityState={{ selected: allPicked }}
                    testID="selection-pick-all"
                    className={`min-h-11 justify-center rounded-full border ${HAIRLINE} px-4`}
                >
                    <Text className={`text-[14px] ${INK}`}>{allPicked ? 'None' : 'All'}</Text>
                </Pressable>
            ) : null}
            <Pressable
                onPress={onLabel}
                accessibilityRole="button"
                accessibilityLabel="Add a label to the picked entries"
                testID="selection-label"
                className={`min-h-11 justify-center rounded-full border ${HAIRLINE} px-4`}
            >
                <Text className={`text-[14px] ${INK}`}>Add label</Text>
            </Pressable>
            {onRemoveLabel ? (
                <Pressable
                    onPress={onRemoveLabel}
                    accessibilityRole="button"
                    accessibilityLabel="Take a label off the picked entries"
                    testID="selection-remove"
                    className={`min-h-11 justify-center rounded-full border ${HAIRLINE} px-4`}
                >
                    <Text className={`text-[14px] ${INK}`}>Remove</Text>
                </Pressable>
            ) : null}
            <Pressable
                onPress={onDone}
                accessibilityRole="button"
                accessibilityLabel="Stop picking"
                testID="selection-done"
                className="min-h-11 justify-center rounded-full bg-accent-green px-4 dark:bg-accent-green-dark"
            >
                <Text className="text-[14px] text-white dark:text-white">Done</Text>
            </Pressable>
            </View>
        </View>
    );
}
