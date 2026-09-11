import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SettingsSection } from './SettingsSection';

interface AboutSettingsSectionProps {
    readonly onAboutPress: () => void;
    readonly onPrivacyPress: () => void;
    readonly embedded?: boolean;
}

const HAIRLINE = 'border-hairline-light dark:border-hairline-dark';

interface AboutRowProps {
    readonly label: string;
    readonly showBorder?: boolean;
    readonly onPress: () => void;
}

/** One quiet about row — label left, chevron right, hairline between. */
function AboutRow({ label, showBorder = true, onPress }: AboutRowProps) {
    const isDark = useColorScheme() === 'dark';
    const chevronColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            className={`min-h-12 flex-row items-center justify-between py-3 ${
                showBorder ? `border-b ${HAIRLINE}` : ''
            }`}
        >
            <Text className="text-[16px] text-text-light dark:text-text-dark">{label}</Text>
            <MaterialIcons name="chevron-right" size={20} color={chevronColor} />
        </Pressable>
    );
}

export function AboutSettingsSection({
    onAboutPress,
    onPrivacyPress,
    embedded = false,
}: AboutSettingsSectionProps) {
    return (
        <SettingsSection title="About" embedded={embedded}>
            <View>
                <AboutRow label="About Blackrose" onPress={onAboutPress} />
                <AboutRow label="Privacy Policy" showBorder={false} onPress={onPrivacyPress} />
            </View>
        </SettingsSection>
    );
}
