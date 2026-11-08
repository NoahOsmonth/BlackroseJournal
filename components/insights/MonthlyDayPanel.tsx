import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatWritingDay } from '@/utils/writingDay';
import type { WritingDayGroup } from '@/utils/writingDayRows';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };
const SECONDARY = 'text-text-secondary-light dark:text-text-secondary-dark';

function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

interface MonthlyDayPanelProps {
    readonly dateKey: string;
    readonly day: WritingDayGroup | undefined;
}

/**
 * What was written on one calendar day. Keeping this out of the screen keeps
 * the month screen small and lets the year grid reuse the same plain rows.
 */
export function MonthlyDayPanel({ dateKey, day }: MonthlyDayPanelProps) {
    const isDark = useColorScheme() === 'dark';
    const ink = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const items = day?.items ?? [];

    return (
        <View className="mt-7" testID="monthly-day-panel">
            <View className="h-px w-full bg-hairline-light dark:bg-hairline-dark" />
            <Text className={'mt-5 text-[18px] text-text-light dark:text-text-dark'} style={SERIF} testID="monthly-day-heading">
                {formatWritingDay(dateKey)}
            </Text>
            {items.length > 0 ? (
                <View className="mt-3 gap-3">
                    {items.map((item) => (
                        <Pressable
                            key={item.kind + '-' + item.id}
                            onPress={() => router.push({
                                pathname: item.kind === 'entry' ? '/entry-detail' : '/checkin-detail',
                                params: { id: item.id },
                            })}
                            accessibilityRole="button"
                            accessibilityLabel={'Open ' + item.title}
                            testID={'monthly-day-item-' + item.id}
                            className="min-h-11 justify-center rounded-card border border-hairline-light bg-surface-light p-4 dark:border-hairline-dark dark:bg-surface-dark"
                        >
                            <View className="flex-row items-center justify-between">
                                <Text className="flex-1 text-[15px] text-text-light dark:text-text-dark" numberOfLines={1}>
                                    {item.title}
                                </Text>
                                <MaterialIcons name="chevron-right" size={18} color={ink} />
                            </View>
                            <Text className={'mt-2 text-[13px] leading-[1.5] ' + SECONDARY} numberOfLines={2}>
                                {item.preview || formatTime(item.createdAt)}
                            </Text>
                            <Text className={'mt-2 text-[12px] ' + SECONDARY}>
                                {formatTime(item.createdAt)} · {item.words} words
                            </Text>
                        </Pressable>
                    ))}
                </View>
            ) : (
                <Text className={'mt-4 text-[15px] ' + SECONDARY} testID="monthly-day-empty">
                    Nothing written on this day.
                </Text>
            )}
        </View>
    );
}
