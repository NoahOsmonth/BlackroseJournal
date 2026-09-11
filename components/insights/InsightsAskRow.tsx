import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { BLACKROSE_PALETTE } from '@/constants/theme';

interface InsightsAskRowProps {
    onPress: () => void;
}

export function InsightsAskRow({ onPress }: InsightsAskRowProps) {
    const isDark = useColorScheme() === 'dark';
    const chevron = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;

    return (
        <Pressable
            onPress={onPress}
            className="flex-row items-center gap-3 border-t border-hairline-light dark:border-hairline-dark pt-4"
            accessibilityRole="button"
            accessibilityLabel="Ask about your journal"
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
        >
            <View className="flex-1">
                <Text className="text-[15px] text-text-light dark:text-text-dark">
                    Ask about your journal
                </Text>
                <Text className="mt-0.5 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    Patterns across entries, moods, and people
                </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={chevron} />
        </Pressable>
    );
}
