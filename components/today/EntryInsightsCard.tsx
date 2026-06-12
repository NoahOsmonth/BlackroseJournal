import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface EntryInsightsCardProps {
    question: string;
    onRefresh: () => void;
    onBookmark: () => void;
    onMore: () => void;
}

export function EntryInsightsCard({
    question,
    onRefresh,
    onBookmark,
    onMore,
}: EntryInsightsCardProps) {
    return (
        <View className="gap-3">
            <Text className="text-[13px] font-semibold text-text-secondary-light dark:text-text-secondary-dark text-center">
                Based on your entries
            </Text>
            <View className="bg-surface-light dark:bg-surface-dark rounded-[24px] p-6 shadow-soft border border-gray-100 dark:border-white/5">
                <Text className="text-[16px] leading-relaxed text-center font-medium mb-6 text-text-light dark:text-text-dark">
                    {question}
                </Text>
                <View className="flex-row items-center justify-center gap-10">
                    <Pressable onPress={onRefresh} accessibilityLabel="Refresh insight">
                        <MaterialIcons name="sync" size={24} color="#9CA3AF" />
                    </Pressable>
                    <Pressable onPress={onBookmark} accessibilityLabel="Save insight">
                        <MaterialIcons name="bookmark" size={24} color="#9CA3AF" />
                    </Pressable>
                    <Pressable onPress={onMore} accessibilityLabel="More options">
                        <MaterialIcons name="more-horiz" size={24} color="#9CA3AF" />
                    </Pressable>
                </View>
            </View>
        </View>
    );
}
