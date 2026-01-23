/**
 * AppHeader Component
 * Shared header for Today and Journal History screens
 */

import { useColorScheme } from '@/hooks/theme/use-color-scheme';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

type HeaderVariant = 'today' | 'journal';

interface AppHeaderProps {
    title: string;
    variant: HeaderVariant;
    onLeftPress?: () => void;
    onRightPress?: () => void;
}

interface IconConfig {
    iconSet: 'ion' | 'material';
    name: string;
    color: string;
    size: number;
}

function getVariantStyles(variant: HeaderVariant) {
    if (variant === 'journal') {
        return {
            containerClassName:
                'bg-surface-light/95 dark:bg-surface-dark/95 border-b border-divider-light ' +
                'dark:border-divider-dark px-4 py-3 flex-row items-center justify-between z-10',
            titleClassName: 'text-lg font-bold tracking-tight text-text-light dark:text-text-dark',
        };
    }

    return {
        containerClassName: 'flex-row items-center justify-between px-6 py-4 z-10',
        titleClassName: 'text-lg font-bold text-text-main-light dark:text-text-main-dark',
    };
}

function getIconConfig(variant: HeaderVariant, isDark: boolean) {
    const leftIcon: IconConfig =
        variant === 'journal'
            ? { iconSet: 'ion', name: 'gift-outline', color: '#8E8E93', size: 24 }
            : {
                iconSet: 'material',
                name: 'card-giftcard',
                color: isDark ? '#A0A0A0' : '#757575',
                size: 24,
            };

    const rightIcon: IconConfig =
        variant === 'journal'
            ? {
                iconSet: 'ion',
                name: 'menu',
                color: isDark ? '#E5E5E7' : '#1C1C1E',
                size: 24,
            }
            : {
                iconSet: 'material',
                name: 'menu',
                color: isDark ? '#E0E0E0' : '#333333',
                size: 24,
            };

    return { leftIcon, rightIcon };
}

function renderIcon(icon: IconConfig) {
    if (icon.iconSet === 'ion') {
        return <Ionicons name={icon.name as never} size={icon.size} color={icon.color} />;
    }

    return <MaterialIcons name={icon.name as never} size={icon.size} color={icon.color} />;
}

export function AppHeader({ title, variant, onLeftPress, onRightPress }: AppHeaderProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const styles = getVariantStyles(variant);
    const icons = getIconConfig(variant, isDark);

    return (
        <View className={styles.containerClassName}>
            <Pressable
                onPress={onLeftPress}
                className="p-2 -ml-2"
                hitSlop={8}
                accessibilityLabel="Open rewards"
                accessibilityRole="button"
                accessibilityState={{ disabled: !onLeftPress }}
            >
                {renderIcon(icons.leftIcon)}
            </Pressable>

            <Text className={styles.titleClassName}>{title}</Text>

            <Pressable
                onPress={onRightPress}
                className="p-2 -mr-2"
                hitSlop={8}
                accessibilityLabel="Open settings"
                accessibilityRole="button"
                accessibilityState={{ disabled: !onRightPress }}
            >
                {renderIcon(icons.rightIcon)}
            </Pressable>
        </View>
    );
}
