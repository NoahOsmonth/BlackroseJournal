import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface EntryInsightsCardProps {
    question: string;
    onRefresh: () => void;
    onBookmark: () => void;
    onMore: () => void;
    onPress?: () => void;
}

/**
 * The day's question, set as the one serif moment on an otherwise quiet surface.
 * Actions are outline-free glyphs in the muted ink so they never compete with
 * the sentence.
 */
export function EntryInsightsCard({
    question,
    onRefresh,
    onBookmark,
    onMore,
    onPress,
}: EntryInsightsCardProps) {
    const isDark = useColorScheme() === 'dark';
    const iconColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;

    return (
        <View className="gap-3">
            <Text className="text-center text-[12px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark">
                Based on your entries
            </Text>
            <View className="gap-5 rounded-card border border-hairline-light bg-surface-light p-5 dark:border-hairline-dark dark:bg-surface-dark">
                <Pressable
                    onPress={onPress}
                    disabled={!onPress}
                    accessibilityRole="button"
                    accessibilityLabel="Open insight conversation"
                    className="active:opacity-80"
                >
                    <Text
                        className="text-center text-[19px] leading-8 text-text-light dark:text-text-dark"
                        numberOfLines={6}
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                    >
                        {question}
                    </Text>
                </Pressable>

                <View className="h-px w-full bg-hairline-light dark:bg-hairline-dark" />

                <View className="flex-row items-center justify-center gap-10">
                    <Pressable
                        onPress={(e) => { e.stopPropagation(); onRefresh(); }}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Refresh insight"
                    >
                        <MaterialIcons name="sync" size={20} color={iconColor} />
                    </Pressable>
                    <Pressable
                        onPress={(e) => { e.stopPropagation(); onBookmark(); }}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Save insight"
                    >
                        <MaterialIcons name="bookmark-border" size={20} color={iconColor} />
                    </Pressable>
                    <Pressable
                        onPress={(e) => { e.stopPropagation(); onMore(); }}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="More options"
                    >
                        <MaterialIcons name="more-horiz" size={20} color={iconColor} />
                    </Pressable>
                </View>
            </View>
        </View>
    );
}
