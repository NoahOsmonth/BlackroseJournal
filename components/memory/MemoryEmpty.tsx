import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { RoseMark } from '@/components/ui/RoseMark';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface MemoryEmptyProps {
    onWritePress: () => void;
}

export function MemoryEmpty({ onWritePress }: MemoryEmptyProps) {
    const isDark = useColorScheme() === 'dark';
    const markColor = isDark ? BLACKROSE_PALETTE.dark.accent : BLACKROSE_PALETTE.light.accent;

    return (
        <View
            className="items-center gap-3 px-6 py-14"
            accessibilityLabel="Your memory grows as you journal"
        >
            <RoseMark size={30} color={markColor} variant="bloom" />
            <Text
                className="text-center text-2xl text-text-light dark:text-text-dark"
                style={{ fontFamily: 'PlayfairDisplayRegular' }}
            >
                Still quiet here
            </Text>
            <Text className="max-w-xs text-center text-sm leading-relaxed text-text-secondary-light dark:text-text-secondary-dark">
                Blackrose keeps private context from finished entries and notes you pin.
            </Text>
            <Pressable
                onPress={onWritePress}
                className="mt-3 rounded-control border border-hairline-light px-4 py-2.5 dark:border-hairline-dark"
                accessibilityRole="button"
                accessibilityLabel="Write your first entry"
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            >
                <Text className="text-sm text-text-light dark:text-text-dark">
                    Write your first entry
                </Text>
            </Pressable>
        </View>
    );
}
