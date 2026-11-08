import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNavBack } from '@/hooks/navigation/useNavBack';
import { useOnThisDayTimeline } from '@/hooks/today/useOnThisDayTimeline';
import { getLocalDateKey } from '@/utils/date';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };
const SECONDARY = 'text-text-secondary-light dark:text-text-secondary-dark';
const CARD = 'border-hairline-light bg-surface-light dark:border-hairline-dark dark:bg-surface-dark';

export default function OnThisDayScreen() {
    const isDark = useColorScheme() === 'dark';
    const iconColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const back = useNavBack('/(tabs)/today');
    // One clock read on mount; stepping is pure date math from this key.
    const [dateKey, setDateKey] = useState(() => getLocalDateKey());
    const { timeline, isLoading, stepDate } = useOnThisDayTimeline(dateKey);

    const step = (delta: number) => setDateKey((key) => stepDate(key, delta));

    return (
        <ScreenContainer edges="top">
            <View className="flex-row items-center gap-3 px-6 pt-2">
                <Pressable
                    onPress={back}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                    testID="on-this-day-back"
                    className="min-h-11 w-11 items-center justify-center rounded-control border border-hairline-light dark:border-hairline-dark"
                >
                    <MaterialIcons name="arrow-back" size={20} color={iconColor} />
                </Pressable>
                <Text className="flex-1 text-[22px] text-text-light dark:text-text-dark" style={SERIF}>
                    On this day
                </Text>
            </View>

            <View className="flex-row items-center justify-between gap-3 px-6 pb-2 pt-3">
                <Pressable
                    onPress={() => step(-1)}
                    accessibilityRole="button"
                    accessibilityLabel="Show the day before"
                    testID="on-this-day-prev"
                    className="min-h-11 w-11 items-center justify-center rounded-control border border-hairline-light dark:border-hairline-dark"
                >
                    <MaterialIcons name="chevron-left" size={20} color={iconColor} />
                </Pressable>
                <View className="items-center">
                    <Text className="text-[15px] text-text-light dark:text-text-dark">
                        {timeline.dateLabel}
                    </Text>
                    <Text className={'mt-1 text-[12px] ' + SECONDARY}>
                        {timeline.totalMemories === 1
                            ? '1 memory from a past year'
                            : `${timeline.totalMemories} memories from past years`}
                    </Text>
                </View>
                <Pressable
                    onPress={() => step(1)}
                    accessibilityRole="button"
                    accessibilityLabel="Show the day after"
                    testID="on-this-day-next"
                    className="min-h-11 w-11 items-center justify-center rounded-control border border-hairline-light dark:border-hairline-dark"
                >
                    <MaterialIcons name="chevron-right" size={20} color={iconColor} />
                </Pressable>
            </View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                {timeline.years.length === 0 ? (
                    <View className="items-center px-8 pt-16" testID="on-this-day-empty">
                        <Text className="text-center text-[22px] text-text-light dark:text-text-dark" style={SERIF}>
                            {isLoading ? 'Looking back…' : 'Nothing here yet'}
                        </Text>
                        <Text className={'mt-3 text-center text-[15px] leading-[1.5] ' + SECONDARY}>
                            {isLoading
                                ? 'Reading your earlier writing.'
                                : `No writing from ${timeline.dateLabel} in past years. Try another day.`}
                        </Text>
                    </View>
                ) : (
                    <View className="gap-6 pt-3">
                        {timeline.years.map((group) => (
                            <View key={group.year} className="gap-3">
                                <Text className={'text-[11px] uppercase tracking-[1.5px] ' + SECONDARY}>
                                    {group.label} · {group.year}
                                </Text>
                                {group.entries.map((entry) => {
                                    const isCheckIn = entry.id.startsWith('checkin-');
                                    return (
                                        <Pressable
                                            key={entry.id}
                                            onPress={() => router.push({
                                                pathname: isCheckIn ? '/checkin-detail' : '/entry-detail',
                                                params: { id: entry.sourceId },
                                            })}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Open ${entry.title}`}
                                            testID={`on-this-day-memory-${entry.id}`}
                                            className={'rounded-card border px-4 py-4 ' + CARD}
                                        >
                                            <Text className="text-[16px] text-text-light dark:text-text-dark" numberOfLines={1}>
                                                {entry.title}
                                            </Text>
                                            <Text
                                                className={'mt-1 text-[14px] leading-[1.5] ' + SECONDARY}
                                                numberOfLines={2}
                                            >
                                                {entry.summary}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </ScreenContainer>
    );
}
