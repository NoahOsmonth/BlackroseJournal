import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/theme/use-theme-color';

interface EntryInsightsCardProps {
    question: string;
    onRefresh: () => void;
    onBookmark: () => void;
    onMore: () => void;
    onPress?: () => void;
}

export function EntryInsightsCard({
    question,
    onRefresh,
    onBookmark,
    onMore,
    onPress,
}: EntryInsightsCardProps) {
    const iconColor = useThemeColor({}, 'icon');

    return (
        <View className="gap-3">
            <Text className="text-[13px] font-semibold text-text-secondary-light dark:text-text-secondary-dark text-center">
                Based on your entries
            </Text>
            <View className="bg-surface-light dark:bg-surface-dark rounded-[24px] p-6 shadow-soft border border-gray-100 dark:border-white/5 gap-6">
                <Pressable
                    onPress={onPress}
                    disabled={!onPress}
                    accessibilityRole="button"
                    accessibilityLabel="Open insight conversation"
                    className="active:opacity-80"
                >
                    <Text className="text-[16px] leading-relaxed text-center font-medium text-text-light dark:text-text-dark">
                        {question}
                    </Text>
                </Pressable>

                <View className="flex-row items-center justify-center gap-10">
                    <Pressable
                        onPress={(e) => { e.stopPropagation(); onRefresh(); }}
                        hitSlop={8}
                        accessibilityLabel="Refresh insight"
                    >
                        <MaterialIcons name="sync" size={24} color={iconColor} />
                    </Pressable>
                    <Pressable
                        onPress={(e) => { e.stopPropagation(); onBookmark(); }}
                        hitSlop={8}
                        accessibilityLabel="Save insight"
                    >
                        <MaterialIcons name="bookmark" size={24} color={iconColor} />
                    </Pressable>
                    <Pressable
                        onPress={(e) => { e.stopPropagation(); onMore(); }}
                        hitSlop={8}
                        accessibilityLabel="More options"
                    >
                        <MaterialIcons name="more-horiz" size={24} color={iconColor} />
                    </Pressable>
                </View>
            </View>
        </View>
    );
}
