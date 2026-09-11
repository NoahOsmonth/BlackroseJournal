import React, { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

interface EmptyStateProps {
    title: string;
    message: string;
    icon?: MaterialIconName;
    actionLabel?: string;
    onActionPress?: () => void;
}

/**
 * Quiet empty state: a muted medallion, serif line, then an outlined verb.
 * Replaces the tinted icon chip + filled orange CTA of the old theme.
 */
export function EmptyState({
    title,
    message,
    icon = 'auto-awesome',
    actionLabel,
    onActionPress,
}: EmptyStateProps) {
    const isDark = useColorScheme() === 'dark';
    const ink = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const hasAction = Boolean(actionLabel && onActionPress);

    return (
        <View
            className="items-center rounded-card border border-hairline-light bg-surface-light px-5 py-7 dark:border-hairline-dark dark:bg-surface-dark"
            accessibilityLabel={`${title}. ${message}`}
        >
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-full border border-hairline-light dark:border-hairline-dark">
                <MaterialIcons name={icon} size={20} color={ink} />
            </View>
            <Text
                className="text-center text-[21px] leading-[29px] text-text-light dark:text-text-dark"
                style={{ fontFamily: 'PlayfairDisplayRegular' }}
            >
                {title}
            </Text>
            <Text className="mt-2 text-center text-[15px] leading-[23px] text-text-secondary-light dark:text-text-secondary-dark">
                {message}
            </Text>
            {hasAction ? (
                <Pressable
                    onPress={onActionPress}
                    className="mt-5 min-h-12 items-center justify-center rounded-control border border-bone-light px-6 dark:border-bone-dark"
                    accessibilityRole="button"
                    accessibilityLabel={actionLabel}
                >
                    <Text className="text-[16px] text-text-light dark:text-text-dark">
                        {actionLabel}
                    </Text>
                </Pressable>
            ) : null}
        </View>
    );
}
