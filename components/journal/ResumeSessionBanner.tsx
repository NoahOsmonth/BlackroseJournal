/**
 * Resume Session Banner
 *
 * Dismissible banner surfaced when an autosaved chat session is recoverable.
 * Lets the user jump back into the last interrupted conversation.
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { BLACKROSE_PALETTE } from '@/constants/theme';

interface ResumeSessionBannerProps {
    title: string;
    onResume: () => void;
    onDismiss: () => void;
}

export function ResumeSessionBanner({ title, onResume, onDismiss }: ResumeSessionBannerProps) {
    const isDark = useColorScheme() === 'dark';
    const dismissColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;

    return (
        <View className="mb-4 flex-row items-center gap-3 rounded-card border border-hairline-light bg-surface-light px-4 py-3 dark:border-hairline-dark dark:bg-surface-dark">
            <Pressable
                onPress={onResume}
                accessibilityRole="button"
                accessibilityLabel="Resume your last conversation"
                className="min-w-0 flex-1 flex-row items-center gap-3 active:opacity-80"
            >
                <View className="h-9 w-9 items-center justify-center rounded-full border border-hairline-light dark:border-hairline-dark">
                    <MaterialIcons
                        name="history"
                        size={18}
                        color={isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2}
                    />
                </View>

                <View className="min-w-0 flex-1">
                    <Text className="text-[15px] text-text-light dark:text-text-dark">
                        Resume your last conversation
                    </Text>
                    <Text
                        className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark"
                        numberOfLines={1}
                    >
                        {title}
                    </Text>
                </View>
            </Pressable>

            <Pressable
                onPress={onDismiss}
                accessibilityRole="button"
                accessibilityLabel="Dismiss resume banner"
                hitSlop={8}
                className="min-h-11 min-w-11 items-center justify-center"
            >
                <MaterialIcons name="close" size={20} color={dismissColor} />
            </Pressable>
        </View>
    );
}
