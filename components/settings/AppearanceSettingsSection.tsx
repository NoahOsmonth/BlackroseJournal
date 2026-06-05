import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import type {
    EmojiStylePreference,
    ThemePreference,
} from '@/hooks/useThemeSettings';
import { SettingsSection } from './SettingsSection';

interface AppearanceSettingsSectionProps {
    readonly theme: ThemePreference;
    readonly emojiStyle: EmojiStylePreference;
    readonly onThemeChange: (theme: ThemePreference) => void;
    readonly onEmojiStyleChange: (style: EmojiStylePreference) => void;
}

interface OptionButtonProps<TValue extends string> {
    readonly label: string;
    readonly value: TValue;
    readonly activeValue: TValue;
    readonly onPress: (value: TValue) => void;
    readonly accessibilityLabel: string;
}

function OptionButton<TValue extends string>({
    label,
    value,
    activeValue,
    onPress,
    accessibilityLabel,
}: OptionButtonProps<TValue>) {
    const isActive = activeValue === value;

    return (
        <TouchableOpacity
            onPress={() => onPress(value)}
            className={`flex-1 items-center justify-center py-3 rounded-xl border ${
                isActive
                    ? 'bg-primary border-transparent'
                    : 'bg-transparent border-divider-light dark:border-divider-dark'
            }`}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={accessibilityLabel}
        >
            <Text className={`font-semibold ${
                isActive ? 'text-white' : 'text-text-light dark:text-text-dark'
            }`}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}

export function AppearanceSettingsSection({
    theme,
    emojiStyle,
    onThemeChange,
    onEmojiStyleChange,
}: AppearanceSettingsSectionProps) {
    return (
        <SettingsSection title="Appearance">
            <Text className="text-sm text-text-light dark:text-text-dark mb-2 font-medium">
                Theme
            </Text>
            <View className="flex-row gap-3 mb-6">
                <OptionButton
                    label="Light"
                    value="light"
                    activeValue={theme}
                    onPress={onThemeChange}
                    accessibilityLabel="Select Light theme"
                />
                <OptionButton
                    label="Dark"
                    value="dark"
                    activeValue={theme}
                    onPress={onThemeChange}
                    accessibilityLabel="Select Dark theme"
                />
                <OptionButton
                    label="System"
                    value="system"
                    activeValue={theme}
                    onPress={onThemeChange}
                    accessibilityLabel="Select System theme"
                />
            </View>

            <Text className="text-sm text-text-light dark:text-text-dark mb-2 font-medium">
                Emoji Style
            </Text>
            <View className="flex-row gap-3">
                <OptionButton
                    label="Native"
                    value="native"
                    activeValue={emojiStyle}
                    onPress={onEmojiStyleChange}
                    accessibilityLabel="Select Native emoji style"
                />
                <OptionButton
                    label="Flat"
                    value="flat"
                    activeValue={emojiStyle}
                    onPress={onEmojiStyleChange}
                    accessibilityLabel="Select Flat emoji style"
                />
                <OptionButton
                    label="3D"
                    value="3d"
                    activeValue={emojiStyle}
                    onPress={onEmojiStyleChange}
                    accessibilityLabel="Select 3D emoji style"
                />
            </View>
        </SettingsSection>
    );
}
