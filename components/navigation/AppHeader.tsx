/**
 * Blackrose headers.
 *
 * `today` — the concept header: line rose mark + "Blackrose" wordmark on the
 * left, settings gear on the right. The streak is a quiet text row under the
 * mark, never a flame badge.
 * `history` — serif "Archive" title with a search glyph, a full-bleed hairline,
 * then a week meta line with the drafts link beneath it.
 *
 * Both variants use the shared Blackrose tokens (surface hairline, bone accent,
 * two-way ink) so the shell reads the same on every tab.
 */

import { useColorScheme } from '@/hooks/theme/use-color-scheme';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { RoseMark } from '@/components/ui/RoseMark';
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
    /** Archive meta line, e.g. "This week · Jan 18–24". */
    weekLabel?: string;
    onSearchPress?: () => void;
}

function TodayHeader({
    streakCount,
    onLeftPress,
    onRightPress,
}: Pick<AppHeaderProps, 'streakCount' | 'onLeftPress' | 'onRightPress'>) {
    const isDark = useColorScheme() === 'dark';
    const markColor = isDark ? BLACKROSE_PALETTE.dark.accent : BLACKROSE_PALETTE.light.accent;
    const gearColor = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;

    return (
        <View className="px-6 pt-3 pb-2">
            <View className="flex-row items-center justify-between">
                <Pressable
                    onPress={onLeftPress}
                    className="flex-row items-center gap-2.5"
                    accessibilityLabel="Open streak view"
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !onLeftPress }}
                    hitSlop={8}
                >
                    <RoseMark size={28} color={markColor} variant="bloom" />
                    {/* Wordmark is the concept's small sans line — the screen's
                        one serif moment is the date below it. */}
                    <Text className="text-[13px] tracking-[0.5px] text-text-light dark:text-text-dark">
                        Blackrose
                    </Text>
                </Pressable>

                <Pressable
                    onPress={onRightPress}
                    className="h-9 w-9 items-center justify-center"
                    accessibilityLabel="Open settings"
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !onRightPress }}
                    hitSlop={8}
                >
                    <MaterialIcons name="settings" size={24} color={gearColor} />
                </Pressable>
            </View>

            {/* Streak is a quiet meta line, not a badge. */}
            <Text className="mt-2 text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                {streakCount ?? 0} {(streakCount ?? 0) === 1 ? 'day' : 'days'}
            </Text>
        </View>
    );
}

function HistoryHeader({
    draftCount,
    onDraftsPress,
    weekLabel,
    onSearchPress,
}: Pick<AppHeaderProps, 'draftCount' | 'onDraftsPress' | 'weekLabel' | 'onSearchPress'>) {
    const isDark = useColorScheme() === 'dark';
    const glyphColor = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const activeDrafts = (draftCount ?? 0) > 0;
    const draftsLabel = activeDrafts
        ? `${draftCount} draft${draftCount === 1 ? '' : 's'}`
        : 'Drafts';

    return (
        <View>
            <View className="flex-row items-center justify-between px-6 pt-4 pb-3">
                {/* One serif moment per screen: the title. */}
                <Text
                    className="text-[26px] leading-tight text-text-light dark:text-text-dark"
                    style={{ fontFamily: 'PlayfairDisplayRegular' }}
                >
                    Archive
                </Text>

                <Pressable
                    onPress={onSearchPress}
                    accessibilityLabel="Search archive"
                    accessibilityRole="button"
                    hitSlop={10}
                    testID="archive-search-button"
                >
                    <MaterialIcons name="search" size={24} color={glyphColor} />
                </Pressable>
            </View>

            {/* Full-bleed rule under the title row, then the week meta line. */}
            <View className="h-px bg-hairline-light dark:bg-hairline-dark" />

            <View className="flex-row items-center justify-between px-6 pt-4 pb-1">
                {weekLabel ? (
                    <Text className="text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
                        {weekLabel}
                    </Text>
                ) : (
                    <View />
                )}

                <Pressable
                    onPress={onDraftsPress}
                    accessibilityLabel="Open drafts"
                    accessibilityRole="button"
                    hitSlop={8}
                    testID="drafts-button"
                >
                    <Text className="text-[15px] text-text-light underline dark:text-text-dark">
                        {draftsLabel}
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}

export function AppHeader({
    variant,
    streakCount,
    onLeftPress,
    onRightPress,
    draftCount,
    onDraftsPress,
    weekLabel,
    onSearchPress,
}: AppHeaderProps) {
    return (
        <View className="bg-background-light dark:bg-background-dark">
            {variant === 'today' ? (
                <TodayHeader
                    streakCount={streakCount}
                    onLeftPress={onLeftPress}
                    onRightPress={onRightPress}
                />
            ) : (
                <HistoryHeader
                    draftCount={draftCount}
                    onDraftsPress={onDraftsPress}
                    weekLabel={weekLabel}
                    onSearchPress={onSearchPress}
                />
            )}
        </View>
    );
}
