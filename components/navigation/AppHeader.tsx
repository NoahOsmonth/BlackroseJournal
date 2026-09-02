import { useColorScheme } from '@/hooks/theme/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

type HeaderVariant = 'today' | 'history';

interface AppHeaderProps {
    variant: HeaderVariant;
    title?: string;
    streakCount?: number;
    onLeftPress?: () => void;
    onRightPress?: () => void;
    /** @deprecated History no longer shows a week range trophy header. */
    weekRange?: string;
    draftCount?: number;
    onDraftsPress?: () => void;
    monthLabel?: string;
}

function TodayHeader({
    title,
    streakCount,
    onLeftPress,
    onRightPress,
}: Pick<AppHeaderProps, 'title' | 'streakCount' | 'onLeftPress' | 'onRightPress'>) {
    const isDark = useColorScheme() === 'dark';
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
                    <MaterialIcons name="local-fire-department" size={20} color={isDark ? '#FFB340' : '#FF9F0A'} />
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
                        color={isDark ? '#E5E5E7' : '#9CA3AF'}
                    />
                </Pressable>
            </View>
        </View>
    );
}

function HistoryHeader({
    draftCount,
    onDraftsPress,
    monthLabel,
}: Pick<AppHeaderProps, 'draftCount' | 'onDraftsPress' | 'monthLabel'>) {
    const isDark = useColorScheme() === 'dark';
    const chevronColor = isDark ? '#9CA3AF' : '#6B7280';
    const activeDrafts = (draftCount ?? 0) > 0;
    const draftsLabel = activeDrafts
        ? `${draftCount} draft${draftCount === 1 ? '' : 's'}`
        : 'Drafts';

    return (
        <View className="px-4 pt-4 pb-2">
            <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                    <Text
                        className="text-3xl font-bold text-text-light dark:text-text-dark"
                        style={{ fontFamily: 'PlayfairDisplayBold' }}
                    >
                        History
                    </Text>
                    {monthLabel ? (
                        <Text className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                            {monthLabel}
                        </Text>
                    ) : null}
                </View>

                <Pressable
                    onPress={onDraftsPress}
                    style={({ pressed }) => [
                        { transform: [{ scale: pressed ? 0.96 : 1 }] },
                    ]}
                    className="mt-1 flex-row items-center gap-1.5 rounded-full border border-divider-light dark:border-divider-dark bg-surface-light dark:bg-surface-dark px-3 py-1.5"
                    accessibilityLabel="Open drafts"
                    accessibilityRole="button"
                    testID="drafts-button"
                >
                    <View
                        className={`h-1.5 w-1.5 rounded-full ${
                            activeDrafts ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                    />
                    <Text
                        numberOfLines={1}
                        className={`text-xs font-semibold ${
                            activeDrafts
                                ? 'text-text-light dark:text-text-dark'
                                : 'text-text-secondary-light dark:text-text-secondary-dark'
                        }`}
                    >
                        {draftsLabel}
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
    draftCount,
    onDraftsPress,
    monthLabel,
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
                    draftCount={draftCount}
                    onDraftsPress={onDraftsPress}
                    monthLabel={monthLabel}
                />
            )}
        </View>
    );
}
