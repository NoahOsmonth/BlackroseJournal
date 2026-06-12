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
                    <Text className="text-sm font-bold text-text-light dark:text-text-dark">
                        {streakCount ?? 0}
                    </Text>
                </Pressable>

                <Text className="text-base font-semibold text-text-light dark:text-text-dark">
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
    const isDark = useColorScheme() === 'dark';
    const chevronColor = isDark ? '#F9FAFB' : '#111827';
    const activeDrafts = (draftCount ?? 0) > 0;

    return (
        <View className="px-6 pt-6 pb-3">
            <View className="items-center gap-4">
                <View className="items-center">
                    <Text className="text-[10px] font-bold tracking-[0.2em] uppercase text-text-secondary-light dark:text-text-secondary-dark mb-1.5">
                        This week
                    </Text>
                    <Text className="text-xl font-bold tracking-tight text-text-main-light dark:text-text-main-dark">
                        {weekRange}
                    </Text>
                </View>

                <Pressable
                    onPress={onDraftsPress}
                    style={({ pressed }) => [
                        { transform: [{ scale: pressed ? 0.96 : 1 }] }
                    ]}
                    className="flex-row items-center gap-2 bg-surface-light dark:bg-surface-dark border-[0.5px] border-divider-light dark:border-divider-dark px-4 py-1.5 rounded-full shadow-soft"
                    accessibilityLabel="Open drafts"
                    accessibilityRole="button"
                    testID="drafts-button"
                >
                    <View className={`w-1.5 h-1.5 rounded-full ${activeDrafts ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`} />
                    <Text 
                        numberOfLines={1}
                        className="text-xs font-bold text-text-main-light dark:text-text-main-dark uppercase tracking-wider"
                    >
                        {draftCount ?? 0} drafts
                    </Text>
                    <MaterialIcons name="chevron-right" size={14} color={chevronColor} />
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
