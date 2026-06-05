import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { SettingsSection } from './SettingsSection';

interface AboutSettingsSectionProps {
    readonly onAboutPress: () => void;
    readonly onPrivacyPress: () => void;
}

interface AboutRowProps {
    readonly label: string;
    readonly iconName: React.ComponentProps<typeof Ionicons>['name'];
    readonly showBorder?: boolean;
    readonly onPress: () => void;
}

function AboutRow({ label, iconName, showBorder = true, onPress }: AboutRowProps) {
    const colorScheme = useColorScheme();
    const iconColor = colorScheme === 'dark' ? '#F9FAFB' : '#111827';

    return (
        <TouchableOpacity
            onPress={onPress}
            className={`flex-row items-center justify-between py-3 ${
                showBorder ? 'border-b border-divider-light dark:border-divider-dark mb-2' : ''
            }`}
            accessibilityRole="button"
        >
            <View className="flex-row items-center gap-3">
                <View className="bg-background-light dark:bg-secondary-dark p-2 rounded-lg">
                    <Ionicons name={iconName} size={20} color={iconColor} />
                </View>
                <Text className="text-text-light dark:text-text-dark font-medium text-base">
                    {label}
                </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={iconColor} />
        </TouchableOpacity>
    );
}

export function AboutSettingsSection({
    onAboutPress,
    onPrivacyPress,
}: AboutSettingsSectionProps) {
    return (
        <SettingsSection title="About">
            <AboutRow label="About" iconName="information-circle-outline" onPress={onAboutPress} />
            <AboutRow
                label="Privacy Policy"
                iconName="shield-checkmark-outline"
                showBorder={false}
                onPress={onPrivacyPress}
            />
        </SettingsSection>
    );
}
