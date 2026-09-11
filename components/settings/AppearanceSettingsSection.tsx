import React from 'react';
import { Pressable, Text, View } from 'react-native';

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
    readonly embedded?: boolean;
}

interface OptionButtonProps<TValue extends string> {
    readonly label: string;
    readonly value: TValue;
    readonly activeValue: TValue;
    readonly onPress: (value: TValue) => void;
    readonly accessibilityLabel: string;
    readonly isLast: boolean;
}

/**
 * One segment of the concept's two stacked switches: three equal cells inside a
 * single rounded outline, the active cell on a filled surface-2 chip. No brand
 * fill and no white-on-orange label.
 */
function OptionButton<TValue extends string>({
    label,
    value,
    activeValue,
    onPress,
    accessibilityLabel,
    isLast,
}: OptionButtonProps<TValue>) {
    const isActive = activeValue === value;

    return (
        <Pressable
            onPress={() => onPress(value)}
            className={[
                'h-12 flex-1 items-center justify-center rounded-control',
                isLast ? '' : 'mr-1',
                isActive ? 'bg-surface-2-light dark:bg-surface-2-dark' : '',
            ].join(' ')}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={accessibilityLabel}
        >
            <Text
                className={
                    isActive
                        ? 'text-[16px] text-text-light dark:text-text-dark'
                        : 'text-[16px] text-text-secondary-light dark:text-text-secondary-dark'
                }
                numberOfLines={1}
            >
                {label}
            </Text>
        </Pressable>
    );
}

export function AppearanceSettingsSection({
    theme,
    emojiStyle,
    onThemeChange,
    onEmojiStyleChange,
    embedded = false,
}: AppearanceSettingsSectionProps) {
    const switches: Array<{
        key: string;
        options: Array<{ label: string; value: string; accessibilityLabel: string }>;
        active: string;
        onPress: (value: string) => void;
    }> = [
        {
            key: 'theme',
            options: [
                { label: 'Light', value: 'light', accessibilityLabel: 'Select Light theme' },
                { label: 'Dark', value: 'dark', accessibilityLabel: 'Select Dark theme' },
                { label: 'System', value: 'system', accessibilityLabel: 'Select System theme' },
            ],
            active: theme,
            onPress: (value) => onThemeChange(value as ThemePreference),
        },
        {
            key: 'emoji',
            options: [
                { label: 'Native', value: 'native', accessibilityLabel: 'Select Native emoji style' },
                { label: 'Flat', value: 'flat', accessibilityLabel: 'Select Flat emoji style' },
                { label: '3D', value: '3d', accessibilityLabel: 'Select 3D emoji style' },
            ],
            active: emojiStyle,
            onPress: (value) => onEmojiStyleChange(value as EmojiStylePreference),
        },
    ];

    return (
        <SettingsSection title="Appearance" embedded={embedded}>
            <View className="gap-4">
                {switches.map((row) => (
                    <View
                        key={row.key}
                        className="flex-row items-stretch overflow-hidden rounded-control border border-hairline-light p-1 dark:border-hairline-dark"
                    >
                        {row.options.map((option, index) => (
                            <OptionButton
                                key={option.value}
                                label={option.label}
                                value={option.value}
                                activeValue={row.active}
                                onPress={row.onPress}
                                accessibilityLabel={option.accessibilityLabel}
                                isLast={index === row.options.length - 1}
                            />
                        ))}
                    </View>
                ))}
            </View>
        </SettingsSection>
    );
}
