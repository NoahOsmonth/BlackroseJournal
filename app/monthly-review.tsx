import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { MonthlyDayPanel } from '@/components/insights/MonthlyDayPanel';
import { WriteOnDayButton } from '@/components/insights/WriteOnDayButton';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNavBack } from '@/hooks/navigation/useNavBack';
import { useMonthlyReview } from '@/hooks/insights/useMonthlyReview';
import { shiftMonth, type MonthlyCalendarDay } from '@/utils/monthlyReview';
import { canWriteOnDay } from '@/utils/writingDay';
import { getLocalDateKey } from '@/utils/date';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };
const SECONDARY = 'text-text-secondary-light dark:text-text-secondary-dark';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Fixed-size cells so the calendar never shrinks to unreadable dots. */
const CELL = 36;

function dayClass(day: MonthlyCalendarDay, isSelected: boolean): string {
    const parts = ['items-center justify-center rounded-[3px]'];
    if (day.dateKey === null) parts.push('opacity-0');
    else if (day.hasWriting) parts.push('bg-bone-light dark:bg-bone-dark');
    else parts.push('bg-surface-2-light dark:bg-surface-2-dark');
    if (day.isToday) parts.push('border border-starred-gold dark:border-starred-gold-dark');
    if (isSelected) parts.push('border-2 border-starred-gold dark:border-starred-gold-dark');
    return parts.join(' ');
}

function dayTextClass(day: MonthlyCalendarDay): string {
    if (day.hasWriting) return 'text-[13px] text-on-bone-light dark:text-on-bone-dark';
    return 'text-[13px] ' + SECONDARY;
}

/**
 * A month in review: 2026 checklist item 7 (weekly AND monthly summaries).
 * Reuses the collections the app already loaded — no new storage key, no AI,
 * no network. Plain language throughout.
 */
export default function MonthlyReviewScreen() {
    const goBack = useNavBack('/(tabs)/insights');
    const isDark = useColorScheme() === 'dark';
    const ink = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const now = new Date();
    const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
    const { review, daysByKey, isLoading } = useMonthlyReview(period.year, period.month);
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    const todayKey = getLocalDateKey();

    const move = (delta: number) => {
        setSelectedDay(null);
        setPeriod((p) => shiftMonth(p.year, p.month, delta));
    };

    const selected = selectedDay ? daysByKey.get(selectedDay) : undefined;

    return (
        <ScreenContainer edges="top">
            <View className="mx-auto w-full max-w-md flex-1 px-5 pt-4">
                <View className="flex-row items-center justify-between">
                    <Pressable
                        onPress={goBack}
                        className="-ml-2 min-h-11 min-w-11 items-center justify-center"
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                    >
                        <MaterialIcons name="arrow-back" size={26} color={ink} />
                    </Pressable>
                    <Text className="text-[24px] leading-[32px] text-text-light dark:text-text-dark" style={SERIF}>
                        A month in review
                    </Text>
                    <View className="min-h-11 min-w-11" />
                </View>
                <View className="mt-4 h-px w-full bg-hairline-light dark:bg-hairline-dark" />

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    {/* Month switcher */}
                    <View className="mt-5 flex-row items-center justify-between">
                        <Pressable
                            onPress={() => move(-1)}
                            accessibilityRole="button"
                            accessibilityLabel="Previous month"
                            testID="monthly-prev"
                            className="min-h-11 min-w-11 items-center justify-center rounded-control border border-hairline-light dark:border-hairline-dark"
                        >
                            <MaterialIcons name="chevron-left" size={22} color={ink} />
                        </Pressable>
                        <Text className="text-[19px] text-text-light dark:text-text-dark" style={SERIF} testID="monthly-label">
                            {review.monthLabel}
                        </Text>
                        <Pressable
                            onPress={() => move(1)}
                            accessibilityRole="button"
                            accessibilityLabel="Next month"
                            testID="monthly-next"
                            className="min-h-11 min-w-11 items-center justify-center rounded-control border border-hairline-light dark:border-hairline-dark"
                        >
                            <MaterialIcons name="chevron-right" size={22} color={ink} />
                        </Pressable>
                    </View>

                    {isLoading ? (
                        <Text className={'mt-8 text-center text-[15px] ' + SECONDARY}>
                            Gathering your month…
                        </Text>
                    ) : (
                        <View className="mt-6 gap-6">
                            {/* Three plain numbers */}
                            <View className="flex-row justify-between">
                                <View className="flex-1 items-center">
                                    <Text className="text-[30px] leading-none text-text-light dark:text-text-dark" style={SERIF}>
                                        {review.daysWritten}
                                    </Text>
                                    <Text className={'mt-2 text-[12px] ' + SECONDARY}>days written</Text>
                                </View>
                                <View className="flex-1 items-center">
                                    <Text className="text-[30px] leading-none text-text-light dark:text-text-dark" style={SERIF}>
                                        {review.totalWords.toLocaleString()}
                                    </Text>
                                    <Text className={'mt-2 text-[12px] ' + SECONDARY}>words</Text>
                                </View>
                                <View className="flex-1 items-center">
                                    <Text className="text-[30px] leading-none text-text-light dark:text-text-dark" style={SERIF}>
                                        {review.longestStreak}
                                    </Text>
                                    <Text className={'mt-2 text-[12px] ' + SECONDARY}>longest run</Text>
                                </View>
                            </View>

                            {/* Month calendar with fixed cells */}
                            <View testID="monthly-calendar">
                                {/* Header cells share the day cells' fixed width and gap,
                                    so each weekday sits exactly above its own column. */}
                                <View className="mb-3 flex-row gap-[4px]">
                                    {WEEKDAYS.map((label) => (
                                        <View key={label} className="items-center" style={{ width: CELL }}>
                                            <Text className={'text-[11px] ' + SECONDARY}>{label}</Text>
                                        </View>
                                    ))}
                                </View>
                                <View className="flex-row flex-wrap gap-[4px]">
                                    {review.calendar.map((day, index) => (
                                        <Pressable
                                            key={day.dateKey ?? 'pad-' + index}
                                            onPress={() => { if (day.dateKey) setSelectedDay(day.dateKey); }}
                                            accessibilityRole="button"
                                            hitSlop={4}
                                            className={dayClass(day, selectedDay === day.dateKey)}
                                            style={{ width: CELL, height: CELL }}
                                            testID={day.dateKey ? 'monthly-day-' + day.dateKey : undefined}
                                            accessibilityLabel={day.dateKey ? day.dateKey + (day.hasWriting ? ', writing saved' : ', nothing written') : ''}
                                        >
                                            <Text className={dayTextClass(day)}>{day.dayNumber ?? ''}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                                <Text className={'mt-3 text-[13px] ' + SECONDARY}>
                                    A filled square is a day you wrote. Tap a day to read it.
                                </Text>
                            </View>

                            {selectedDay ? (
                                <>
                                    <MonthlyDayPanel dateKey={selectedDay} day={selected} />
                                    <WriteOnDayButton
                                        dateKey={selectedDay}
                                        canWrite={canWriteOnDay(selectedDay, todayKey)}
                                        hasWriting={(selected?.items.length ?? 0) > 0}
                                    />
                                </>
                            ) : null}

                            {/* Moods and themes */}
                            <View className="gap-4">
                                <View className="rounded-card border border-hairline-light bg-surface-light px-5 py-5 dark:border-hairline-dark dark:bg-surface-dark">
                                    <Text className="text-[19px] text-text-light dark:text-text-dark" style={SERIF}>
                                        Moods
                                    </Text>
                                    {review.moods.length > 0 ? (
                                        <View className="mt-3 flex-row flex-wrap gap-2">
                                            {review.moods.map((mood) => (
                                                <View key={mood.label} className="rounded-control border border-hairline-light px-3 py-2 dark:border-hairline-dark">
                                                    <Text className="text-[14px] text-text-light dark:text-text-dark">
                                                        {mood.label} · {mood.days} {mood.days === 1 ? 'day' : 'days'}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    ) : (
                                        <Text className={'mt-3 text-[14px] ' + SECONDARY}>
                                            No moods saved this month.
                                        </Text>
                                    )}
                                </View>

                                <View className="rounded-card border border-hairline-light bg-surface-light px-5 py-5 dark:border-hairline-dark dark:bg-surface-dark">
                                    <Text className="text-[19px] text-text-light dark:text-text-dark" style={SERIF}>
                                        What kept coming back
                                    </Text>
                                    {review.themes.length > 0 ? (
                                        <View className="mt-3 flex-row flex-wrap gap-2">
                                            {review.themes.map((theme) => (
                                                <View key={theme.label} className="rounded-control border border-hairline-light px-3 py-2 dark:border-hairline-dark">
                                                    <Text className="text-[14px] text-text-light dark:text-text-dark">
                                                        {theme.label} · {theme.days} days
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    ) : (
                                        <Text className={'mt-3 text-[14px] ' + SECONDARY}>
                                            Not enough writing yet to notice a theme.
                                        </Text>
                                    )}
                                </View>
                            </View>

                            {review.totalEntries === 0 ? (
                                <Text className={'text-[14px] leading-[1.5] ' + SECONDARY}>
                                    Nothing written in this month. Try another month with the arrows above.
                                </Text>
                            ) : null}
                        </View>
                    )}
                    <View className="h-12" />
                </ScrollView>
            </View>
        </ScreenContainer>
    );
}
