import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { HistoryItem } from '@/hooks/history/historyUtils';

interface HistoryEntryCardProps {
    item: HistoryItem;
    onPress: () => void;
    isLast?: boolean;
}

const SECONDARY_TEXT_CLASS = 'text-text-secondary-light dark:text-text-secondary-dark';

function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    });
}

function resolveLabel(item: HistoryItem): string {
    if (item.type === 'checkin') {
        if (item.checkInType === 'evening') return 'Evening reflection';
        if (item.checkInType === 'morning') return 'Morning note';
        return 'Intention setting';
    }
    return 'Journal';
}

/**
 * Archive entry card — surface card, serif title, two-line excerpt, then a
 * full-bleed hairline over the mood row. The concept puts no accent-tinted
 * chrome on the card: type does the work, and the mood is the only trailing
 * detail.
 */
export function HistoryEntryCard({ item, onPress, isLast = false }: HistoryEntryCardProps) {
    const label = resolveLabel(item);
    const moodLabel = item.mood?.trim() || null;

    const handlePress = () => {
        if (Platform.OS !== 'web') {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress();
    };

    return (
        <Pressable
            onPress={handlePress}
            accessibilityLabel={`Open ${item.title}`}
            accessibilityRole="button"
            style={({ pressed }) => [
                { transform: [{ scale: pressed ? 0.985 : 1 }] },
            ]}
            className={`overflow-hidden rounded-card border border-hairline-light bg-surface-light py-5 dark:border-hairline-dark dark:bg-surface-dark ${
                isLast ? '' : 'mb-6'
            }`}
        >
            <View className="gap-3 px-6">
                <View className="flex-row items-center justify-between">
                    <Text className={`text-[14px] ${SECONDARY_TEXT_CLASS}`}>{label}</Text>
                    <Text className={`text-[14px] ${SECONDARY_TEXT_CLASS}`}>
                        {formatTime(item.createdAt)}
                    </Text>
                </View>

                <Text
                    className="text-[22px] leading-snug text-text-light dark:text-text-dark"
                    style={{ fontFamily: 'PlayfairDisplayRegular' }}
                    numberOfLines={2}
                >
                    {item.title}
                </Text>

                {item.summary ? (
                    <Text
                        className={`text-[15px] leading-[1.45] ${SECONDARY_TEXT_CLASS}`}
                        numberOfLines={2}
                    >
                        {item.summary}
                    </Text>
                ) : null}
            </View>

            {moodLabel ? (
                <View className="mt-4 border-t border-hairline-light px-6 pt-4 dark:border-hairline-dark">
                    <Text className={`text-[14px] ${SECONDARY_TEXT_CLASS}`}>{moodLabel}</Text>
                </View>
            ) : null}
        </Pressable>
    );
}
