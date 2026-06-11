/**
 * Resume Session Banner
 *
 * Dismissible banner surfaced when an autosaved chat session is recoverable.
 * Lets the user jump back into the last interrupted conversation.
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/use-color-scheme';

interface ResumeSessionBannerProps {
    title: string;
    onResume: () => void;
    onDismiss: () => void;
}

export function ResumeSessionBanner({ title, onResume, onDismiss }: ResumeSessionBannerProps) {
    const colorScheme = useColorScheme();
    const dismissColor = colorScheme === 'dark' ? '#9CA3AF' : '#6B7280';

    return (
        <View className="flex-row items-center gap-3 rounded-2xl border border-divider-light dark:border-divider-dark bg-surface-light dark:bg-surface-dark px-4 py-3 mb-4">
            <Pressable
                onPress={onResume}
                accessibilityRole="button"
                accessibilityLabel="Resume your last conversation"
                className="flex-1 flex-row items-center gap-3 active:opacity-80"
            >
                <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/15">
                    <MaterialIcons name="history" size={20} color="#FF9F0A" />
                </View>

                <View className="flex-1">
                    <Text className="text-[13px] font-semibold text-text-light dark:text-text-dark">
                        Resume your last conversation
                    </Text>
                    <Text
                        className="text-[12px] text-text-secondary-light dark:text-text-secondary-dark"
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
                className="p-1"
            >
                <MaterialIcons name="close" size={18} color={dismissColor} />
            </Pressable>
        </View>
    );
}
