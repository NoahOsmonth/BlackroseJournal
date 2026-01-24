/**
 * AppHeader Component
 * Shared header for Today and History screens
 */

import { useColorScheme } from '@/hooks/theme/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

type HeaderVariant = 'today' | 'history';

interface AppHeaderProps {
    variant: HeaderVariant;
    title?: string;
    streakCount?: number;
    onLeftPress?: () => void;
    onRightPress?: () => void;
    weekRange?: string;
    draftCount?: number;
    onDraftsPress?: () => void;
}

function TodayHeader({
    title,
    streakCount,
    onLeftPress,
    onRightPress,
}: Pick<AppHeaderProps, 'title' | 'streakCount' | 'onLeftPress' | 'onRightPress'>) {
    return (
        <View className="px-4 pt-2">
            <View className="flex-row items-center justify-between py-3">
                <Pressable
                    onPress={onLeftPress}
                    className="flex-row items-center gap-1.5"
                    accessibilityLabel="Open streak view"
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !onLeftPress }}
                    hitSlop={8}
                >
                    <MaterialIcons name="local-fire-department" size={20} color="#FF9500" />
                    <Text className="text-sm font-bold text-text-light dark:text-white">
                        {streakCount ?? 0}
                    </Text>
                </Pressable>

                <Text className="text-base font-semibold text-text-light dark:text-white">
                    {title ?? ''}
                </Text>

                <Pressable
                    onPress={onRightPress}
                    className="w-8 h-8 rounded-full items-center justify-center"
                    accessibilityLabel="Open settings"
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !onRightPress }}
                    hitSlop={8}
                >
                    <MaterialIcons
                        name="settings"
                        size={20}
                        color="#9CA3AF"
                    />
                </Pressable>
            </View>
        </View>
    );
}

function HistoryHeader({
    weekRange,
    draftCount,
    onDraftsPress,
}: Pick<AppHeaderProps, 'weekRange' | 'draftCount' | 'onDraftsPress'>) {
    return (
        <View className="px-4 pt-6 pb-2">
            <View className="items-center gap-4">
                <View className="w-full bg-surface-light dark:bg-surface-dark p-4 rounded-2xl shadow-soft">
                    <Text className="text-base font-semibold text-text-light dark:text-white text-center mb-1">
                        This week
                    </Text>
                    <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark font-medium text-center">
                        {weekRange}
                    </Text>
                </View>
                <Pressable
                    onPress={onDraftsPress}
                    className="flex-row items-center gap-2 bg-surface-light dark:bg-secondary-dark px-5 py-2.5 rounded-full shadow-soft"
                    accessibilityLabel="Open drafts"
                    accessibilityRole="button"
                >
                    <View className="w-2 h-2 rounded-full bg-black dark:bg-white" />
                    <Text className="text-sm font-medium text-text-light dark:text-gray-200">
                        {draftCount ?? 0} drafts
                    </Text>
                    <MaterialIcons name="chevron-right" size={18} color="#9CA3AF" />
                </Pressable>
            </View>
        </View>
    );
}

export function AppHeader({
    variant,
    title,
    streakCount,
    onLeftPress,
    onRightPress,
    weekRange,
    draftCount,
    onDraftsPress,
}: AppHeaderProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    return (
        <View className={isDark ? 'bg-background-dark' : 'bg-background-light'}>
            {variant === 'today' ? (
                <TodayHeader
                    title={title}
                    streakCount={streakCount}
                    onLeftPress={onLeftPress}
                    onRightPress={onRightPress}
                />
            ) : (
                <HistoryHeader
                    weekRange={weekRange}
                    draftCount={draftCount}
                    onDraftsPress={onDraftsPress}
                />
            )}
        </View>
    );
}
