import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNavBack } from '@/hooks/navigation/useNavBack';
import { useStreakStats } from '@/hooks/streaks/useStreakStats';
import { buildCalendarDays } from '@/utils/streakStats';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const HAIRLINE_BORDER = 'border-hairline-light dark:border-hairline-dark';
const HAIRLINE_RULE = 'bg-hairline-light dark:bg-hairline-dark';
const HAIRLINE_TEXT = 'text-hairline-light dark:text-hairline-dark';
const SERIF = { fontFamily: 'PlayfairDisplayRegular' };

/**
 * Streak detail mirrors `black-rose-rewards.png`: the count as one giant serif
 * numeral, a hairline-flanked "Longest · N", then the month grid. No flame
 * badge and no brand fill — a written day is a bone bead.
 */
export default function StreakViewScreen() {
    const router = useRouter();
    const goBack = useNavBack('/(tabs)/today');
    const { dayKeys, currentStreak, longestStreak, totalDays } = useStreakStats();
    const isDark = useColorScheme() === 'dark';
    const ink = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;

    const today = useMemo(() => new Date(), []);
    const monthLabel = useMemo(
        () => today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        [today]
    );
    const calendarDays = useMemo(
        () => buildCalendarDays(dayKeys, today.getFullYear(), today.getMonth()),
        [dayKeys, today]
    );

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="mx-auto w-full max-w-md flex-1">
                <View className="flex-row items-center justify-between px-5 py-4">
                    <Pressable
                        onPress={goBack}
                        className="-ml-2 min-h-11 min-w-11 items-center justify-center"
                        accessibilityLabel="Back"
                    >
                        <MaterialIcons name="arrow-back" size={26} color={ink} />
                    </Pressable>
                    <Text
                        className="text-[26px] leading-[34px] text-text-light dark:text-text-dark"
                        style={SERIF}
                    >
                        Streak
                    </Text>
                    <Pressable
                        onPress={() => router.push('/rewards')}
                        className="min-h-11 items-center justify-center"
                        accessibilityLabel="Open rewards"
                    >
                        <Text className="text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
                            Rewards
                        </Text>
                    </Pressable>
                </View>
                <View className={`h-px w-full ${HAIRLINE_RULE}`} />

                <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
                    <View className="items-center pt-10">
                        <Text
                            className="text-[92px] leading-[104px] text-text-light dark:text-text-dark"
                            style={SERIF}
                        >
                            {currentStreak}
                        </Text>
                        <Text
                            className="-mt-1 text-[26px] leading-[34px] text-text-light dark:text-text-dark"
                            style={SERIF}
                        >
                            day streak
                        </Text>

                        <View className="mt-8 w-full flex-row items-center gap-4">
                            <View className={`h-px flex-1 ${HAIRLINE_RULE}`} />
                            <Text className="text-[16px] text-text-secondary-light dark:text-text-secondary-dark">
                                Longest · {longestStreak}
                            </Text>
                            <View className={`h-px flex-1 ${HAIRLINE_RULE}`} />
                        </View>

                        <Text className="mt-5 text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
                            {totalDays} days with check-ins
                        </Text>
                    </View>

                    <View className="mt-12">
                        <Text
                            className="mb-4 text-[22px] leading-[30px] text-text-light dark:text-text-dark"
                            style={SERIF}
                        >
                            {monthLabel}
                        </Text>

                        <View className={`rounded-card border ${HAIRLINE_BORDER} pb-2 pt-3`}>
                            <View className="flex-row flex-wrap">
                                {DAY_LABELS.map((label, index) => (
                                    <View
                                        key={`label-${label}-${index}`}
                                        className="w-[14.28%] items-center py-2"
                                    >
                                        <Text
                                            className={`text-[12px] uppercase tracking-[1.2px] ${HAIRLINE_TEXT}`}
                                        >
                                            {label}
                                        </Text>
                                    </View>
                                ))}

                                {calendarDays.map((day, index) => (
                                    <View
                                        key={`day-${index}`}
                                        className="w-[14.28%] items-center py-2"
                                    >
                                        {day.date ? (
                                            <View
                                                className={`h-8 w-8 items-center justify-center rounded-full ${
                                                    day.hasEntry
                                                        ? 'bg-bone-light dark:bg-bone-dark'
                                                        : ''
                                                }`}
                                            >
                                                <Text
                                                    className={
                                                        day.hasEntry
                                                            ? 'text-[14px] text-on-bone-light dark:text-on-bone-dark'
                                                            : 'text-[14px] text-text-secondary-light dark:text-text-secondary-dark'
                                                    }
                                                >
                                                    {day.date.getDate()}
                                                </Text>
                                            </View>
                                        ) : (
                                            <View className="h-8 w-8" />
                                        )}
                                    </View>
                                ))}
                            </View>
                        </View>
                    </View>

                    <View className="h-12" />
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}
