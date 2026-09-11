import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { getIntentionAreaConfig } from '@/constants/intentions';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IntentionArea } from '@/services/intentions/intentionsStorage.types';

interface IntentionAreaButtonProps {
    area: IntentionArea;
    onPress: (area: IntentionArea) => void;
}

/**
 * One life area in the intention picker.
 *
 * Concept `black-rose-intention-picker.png`: a bare serif row inside the sheet's
 * hairline list — no coloured icon, no card per row. The bone bar on the left
 * marks the row under the finger.
 */
export function IntentionAreaButton({ area, onPress }: IntentionAreaButtonProps) {
    const config = getIntentionAreaConfig(area);
    const isDark = useColorScheme() === 'dark';
    const chevronColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;

    return (
        <Pressable
            onPress={() => onPress(area)}
            accessibilityRole="button"
            accessibilityLabel={`Choose ${config?.label ?? area}`}
            className="min-h-[64px] flex-row items-center justify-between border-t border-hairline-light pl-4 pr-5 dark:border-hairline-dark"
        >
            {({ pressed }) => (
                <>
                    <View className="flex-1 flex-row items-center gap-3">
                        <View
                            className={`h-[26px] w-[3px] rounded-full ${
                                pressed ? 'bg-bone-light dark:bg-bone-dark' : 'bg-transparent'
                            }`}
                        />
                        <Text
                            className="text-[19px] text-text-light dark:text-text-dark"
                            style={{ fontFamily: 'PlayfairDisplayRegular' }}
                        >
                            {config?.label ?? area}
                        </Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={22} color={chevronColor} />
                </>
            )}
        </Pressable>
    );
}
