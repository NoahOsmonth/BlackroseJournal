import React from 'react';
import { View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { RoseMark } from '@/components/ui/RoseMark';

/**
 * "New persona" tile avatar: quiet nested surface + the Blackrose line rose,
 * with a small add badge. Replaces the old teal isometric cube field.
 */
export function NewPersonaAvatar() {
    const isDark = useColorScheme() === 'dark';
    const markColor = isDark ? BLACKROSE_PALETTE.dark.accent : BLACKROSE_PALETTE.light.accent;
    const badgeSurface = isDark ? BLACKROSE_PALETTE.dark.surface : BLACKROSE_PALETTE.light.surface;
    const badgeInk = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;

    return (
        <View
            testID="new-persona-avatar"
            className="w-24 h-24 rounded-full items-center justify-center bg-surface-2-light dark:bg-surface-2-dark border border-hairline-light dark:border-hairline-dark"
        >
            <RoseMark size={52} color={markColor} strokeWidth={1.2} />
            <View
                className="absolute -bottom-0.5 -right-0.5 h-7 w-7 rounded-full items-center justify-center border border-hairline-light dark:border-hairline-dark"
                style={{ backgroundColor: badgeSurface }}
            >
                <MaterialIcons name="add" size={18} color={badgeInk} />
            </View>
        </View>
    );
}
