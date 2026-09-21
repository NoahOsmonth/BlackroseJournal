import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { RoseMark } from '@/components/ui/RoseMark';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface MemoryEmptyProps {
    /**
     * Focus the composer on this page. The empty state exists to get a line
     * written here — routing away to chat was the old product's behaviour and
     * is not this action.
     */
    onWritePress: () => void;
}

export function MemoryEmpty({ onWritePress }: MemoryEmptyProps) {
    const isDark = useColorScheme() === 'dark';
    const markColor = isDark ? BLACKROSE_PALETTE.dark.accent : BLACKROSE_PALETTE.light.accent;

    return (
        <View
            className="items-center gap-3 px-6 py-14"
            /* Describes the block and what its action does. The old label
               ("Your memory grows as you journal") promised a growth the visible
               copy no longer makes — the empty state now points at the composer
               on this page, not at journaling elsewhere. */
            accessibilityLabel="Nothing in your memory yet — write a line to start it"
        >
            <RoseMark size={30} color={markColor} variant="bloom" />
            <Text
                className="text-center text-2xl text-text-light dark:text-text-dark"
                style={{ fontFamily: 'PlayfairDisplayRegular' }}
            >
                Still quiet here
            </Text>
            <Text className="max-w-xs text-center text-sm leading-relaxed text-text-secondary-light dark:text-text-secondary-dark">
                Nothing is kept yet. Write a line above and it stays — here and in your archive.
            </Text>
            <Pressable
                onPress={onWritePress}
                className="mt-3 rounded-control border border-hairline-light px-4 py-2.5 dark:border-hairline-dark"
                accessibilityRole="button"
                accessibilityLabel="Write a line"
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
                <Text className="text-sm text-text-light dark:text-text-dark">
                    Write a line
                </Text>
            </Pressable>
        </View>
    );
}
