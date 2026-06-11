import React, { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

interface EmptyStateProps {
    title: string;
    message: string;
    icon?: MaterialIconName;
    actionLabel?: string;
    onActionPress?: () => void;
}

export function EmptyState({
    title,
    message,
    icon = 'auto-awesome',
    actionLabel,
    onActionPress,
}: EmptyStateProps) {
    const isDark = useColorScheme() === 'dark';
    const iconColor = isDark ? Colors.dark.primary : Colors.light.primary;
    const hasAction = Boolean(actionLabel && onActionPress);

    return (
        <View
            className="items-center rounded-2xl border border-divider-light bg-background-light px-4 py-5 dark:border-divider-dark dark:bg-background-dark"
            accessibilityLabel={`${title}. ${message}`}
        >
            <View className="mb-3 rounded-full bg-primary/10 p-3 dark:bg-primary-dark/20">
                <MaterialIcons name={icon} size={22} color={iconColor} />
            </View>
            <Text className="text-center text-sm font-semibold text-text-light dark:text-text-dark">
                {title}
            </Text>
            <Text className="mt-1 text-center text-xs text-text-secondary-light dark:text-text-secondary-dark">
                {message}
            </Text>
            {hasAction ? (
                <Pressable
                    onPress={onActionPress}
                    className="mt-4 rounded-full bg-primary px-4 py-2"
                    accessibilityRole="button"
                    accessibilityLabel={actionLabel}
                >
                    <Text className="text-xs font-bold text-surface-light dark:text-surface-light">
                        {actionLabel}
                    </Text>
                </Pressable>
            ) : null}
        </View>
    );
}
