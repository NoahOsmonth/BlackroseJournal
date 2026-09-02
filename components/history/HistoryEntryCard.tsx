import React, { ComponentProps } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';

import { HistoryItem } from '@/hooks/history/historyUtils';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];
type MetaTone = 'morning' | 'evening' | 'intention' | 'journal';

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
        if (item.checkInType === 'evening') return 'Evening';
        if (item.checkInType === 'morning') return 'Morning';
        return 'Intention';
    }
    return 'Journal';
}

function resolveTone(item: HistoryItem): MetaTone {
    if (item.type === 'checkin') {
        if (item.checkInType === 'evening') return 'evening';
        if (item.checkInType === 'morning') return 'morning';
        return 'intention';
    }
    return 'journal';
}

function resolveIcon(tone: MetaTone): MaterialIconName | null {
    if (tone === 'evening') return 'nights-stay';
    if (tone === 'morning') return 'wb-sunny';
    if (tone === 'intention') return 'flag';
    return null;
}

function resolveMetaColor(tone: MetaTone, isDark: boolean): string {
    const palette = {
        morning: isDark ? '#FFB340' : '#B45309',
        evening: isDark ? '#F9A8D4' : '#BE185D',
        intention: isDark ? '#5EEAD4' : '#0F766E',
        journal: isDark ? '#9CA3AF' : '#6B7280',
    };
    return palette[tone];
}

function resolveMetaTextClass(tone: MetaTone): string {
    if (tone === 'morning') return 'text-primary dark:text-primary-dark';
    if (tone === 'evening') return 'text-persona-rose';
    if (tone === 'intention') return 'text-persona-teal';
    return SECONDARY_TEXT_CLASS;
}

export function HistoryEntryCard({ item, onPress, isLast = false }: HistoryEntryCardProps) {
    const isDark = useColorScheme() === 'dark';
    const label = resolveLabel(item);
    const tone = resolveTone(item);
    const icon = resolveIcon(tone);
    const moodLabel = item.mood?.trim() || null;
    const metaColor = resolveMetaColor(tone, isDark);
    const mutedIconColor = isDark ? '#9CA3AF' : '#6B7280';

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
            className={`px-4 py-3.5 ${
                isLast ? '' : 'border-b border-divider-light dark:border-divider-dark'
            }`}
        >
            <View className="gap-1.5">
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-1.5">
                        {icon ? (
                            <MaterialIcons name={icon} size={13} color={metaColor} />
                        ) : null}
                        <Text className={`text-[12px] font-medium ${resolveMetaTextClass(tone)}`}>
                            {label}
                        </Text>
                    </View>
                    <Text className={`text-[12px] font-medium ${SECONDARY_TEXT_CLASS}`}>
                        {formatTime(item.createdAt)}
                    </Text>
                </View>

                <Text
                    className="text-[16px] font-semibold leading-snug tracking-tight text-text-light dark:text-text-dark"
                    numberOfLines={2}
                >
                    {item.title}
                </Text>

                {item.summary ? (
                    <Text
                        className={`text-sm leading-relaxed ${SECONDARY_TEXT_CLASS}`}
                        numberOfLines={2}
                    >
                        {item.summary}
                    </Text>
                ) : null}

                {moodLabel ? (
                    <View className="mt-0.5 flex-row items-center gap-1 self-start">
                        <MaterialIcons name="sentiment-satisfied" size={13} color={mutedIconColor} />
                        <Text className={`text-xs font-medium ${SECONDARY_TEXT_CLASS}`}>
                            {moodLabel}
                        </Text>
                    </View>
                ) : null}
            </View>
        </Pressable>
    );
}
