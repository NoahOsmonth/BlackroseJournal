import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNavBack } from '@/hooks/navigation/useNavBack';
import { useWritingYear } from '@/hooks/insights/useWritingYear';
import { WriteOnDayButton } from '@/components/insights/WriteOnDayButton';
import { canWriteOnDay, formatWritingDay } from '@/utils/writingDay';
import { clampDayKey, shiftDayKey } from '@/utils/dayStep';
import { getLocalDateKey } from '@/utils/date';
import type { WritingDay, WritingLevel } from '@/utils/writingYear';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };
const SECONDARY = 'text-text-secondary-light dark:text-text-secondary-dark';

/** Fixed cells. A 53-week grid must scroll horizontally, not shrink to 4px. */
const CELL = 14;
const GAP = 3;
const STEP = CELL + GAP;
const GRID_WIDTH = 53 * STEP - GAP;

/** One token pair per tone step. Never interpolate a hex at runtime. */
const LEVEL_CLASS: Record<WritingLevel, string> = {
    0: 'bg-year-0-light dark:bg-year-0-dark',
    1: 'bg-year-1-light dark:bg-year-1-dark',
    2: 'bg-year-2-light dark:bg-year-2-dark',
    3: 'bg-year-3-light dark:bg-year-3-dark',
    4: 'bg-year-4-light dark:bg-year-4-dark',
};

const LEVEL_WORDS = ['Nothing written', 'A few words', 'Some writing', 'A good stretch', 'A full day'];

function dayClass(day: WritingDay): string {
    const parts = ['rounded-[2px]', LEVEL_CLASS[day.level]];
    if (day.isPadding) parts.push('opacity-30');
    if (day.isToday) parts.push('border border-starred-gold dark:border-starred-gold-dark');
    return parts.join(' ');
}

function dayAccessibilityLabel(day: WritingDay): string {
    if (day.isPadding) return '';
    const tone = LEVEL_WORDS[day.level];
    return tone === 'Nothing written'
        ? day.dateKey + ': nothing written'
        : day.dateKey + ': ' + tone.toLowerCase() + ', ' + day.words + ' words';
}

function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * A year of writing: 53 Sunday-first columns of seven readable squares.
 * Tapping one opens that day's writing. All data comes from the local journal
 * through one hook; no network, no AI, no new storage key.
 */
export default function WritingYearScreen() {
    const goBack = useNavBack('/streak-view');
    const isDark = useColorScheme() === 'dark';
    const ink = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const { grid, daysByKey, isLoading } = useWritingYear();
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    const scrollRef = useRef<ScrollView>(null);
    const didScroll = useRef(false);

    // Land on the most recent week instead of forcing a swipe past a year.
    useEffect(() => {
        if (didScroll.current || isLoading) return;
        didScroll.current = true;
        const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 120);
        return () => clearTimeout(id);
    }, [isLoading]);

    const rangeLabel = useMemo(() => {
        const fmt = (key: string) => new Date(key + 'T12:00:00')
            .toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        return fmt(grid.startDateKey) + ' to ' + fmt(grid.endDateKey);
    }, [grid.startDateKey, grid.endDateKey]);

    const selected = selectedDay ? daysByKey.get(selectedDay) : undefined;
    const todayKey = getLocalDateKey();

    // Stepping is the way a day gets chosen (Kaneo #111): 44px controls, one day
    // at a time, clamped to the range the grid draws. Picking from the grid itself
    // is gone because a 14px square cannot be a target.
    const firstKey = grid.startDateKey;
    const lastKey = grid.endDateKey;
    const stepBase = selectedDay ?? lastKey;
    const canStepBack = stepBase > firstKey;
    const canStepForward = stepBase < lastKey;
    const stepDay = (delta: number) => {
        setSelectedDay(clampDayKey(shiftDayKey(stepBase, delta), firstKey, lastKey));
    };

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
                    <Text className="text-[26px] leading-[34px] text-text-light dark:text-text-dark" style={SERIF}>
                        A year of writing
                    </Text>
                    <View className="min-h-11 min-w-11" />
                </View>
                <View className="mt-4 h-px w-full bg-hairline-light dark:bg-hairline-dark" />

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    <Text className={'pt-5 text-[14px] ' + SECONDARY}>{rangeLabel}</Text>

                    <View className="mt-4 flex-row items-end">
                        <Text className="text-[38px] leading-none text-text-light dark:text-text-dark" style={SERIF}>
                            {grid.totalDaysWritten}
                        </Text>
                        <Text className={'ml-2 pb-1 text-[15px] ' + SECONDARY}>days with words</Text>
                    </View>
                    <Text className={'mt-2 text-[14px] ' + SECONDARY}>
                        {grid.totalWords.toLocaleString()} words in the last year
                    </Text>

                    {isLoading ? (
                        <Text className={'mt-8 text-center text-[15px] ' + SECONDARY}>
                            Gathering your days…
                        </Text>
                    ) : (
                        <View className="mt-6">
                            <ScrollView
                                ref={scrollRef}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ width: GRID_WIDTH }}
                                testID="writing-year-grid-scroll"
                            >
                                <View style={{ width: GRID_WIDTH }}>
                                    {/* Labels share the grid's column origin. */}
                                    <View className="mb-2 h-4">
                                        {grid.monthLabels.map((month) => (
                                            <Text
                                                key={month.label + '-' + month.weekIndex}
                                                className={'absolute text-[11px] ' + SECONDARY}
                                                style={{ left: month.weekIndex * STEP }}
                                            >
                                                {month.label}
                                            </Text>
                                        ))}
                                    </View>
                                    <View className="flex-row gap-[3px]">
                                        {grid.weeks.map((week, weekIndex) => (
                                            <View key={'week-' + weekIndex} className="gap-[3px]">
                                                {week.map((day) => (
                                                    // A picture, not a button: 371 cells at 14px are
                                                    // narrower than a fingertip, so the day is chosen
                                                    // with the 44px stepper below (Kaneo #111).
                                                    <View
                                                        key={day.dateKey}
                                                        accessibilityRole="image"
                                                        accessibilityLabel={dayAccessibilityLabel(day)}
                                                        className={dayClass(day)}
                                                        style={{ width: CELL, height: CELL }}
                                                        testID={day.isToday ? 'writing-year-today' : (day.words > 0 ? 'writing-year-day-' + day.dateKey : undefined)}
                                                    />
                                                ))}
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            </ScrollView>

                            {/* The year is a picture; a day is chosen here, one at a
                                time, with targets a fingertip can actually hit. */}
                            <View className="mt-4 flex-row items-center justify-between gap-3">
                                <Pressable
                                    onPress={() => stepDay(-1)}
                                    disabled={!canStepBack}
                                    accessibilityRole="button"
                                    accessibilityLabel="Earlier day"
                                    testID="writing-year-prev-day"
                                    className={
                                        'h-11 w-11 items-center justify-center rounded-control border border-hairline-light dark:border-hairline-dark' +
                                        (canStepBack ? '' : ' opacity-40')
                                    }
                                >
                                    <MaterialIcons name="chevron-left" size={22} color={ink} />
                                </Pressable>
                                <Text
                                    testID="writing-year-stepped-day"
                                    className={'flex-1 text-center text-[14px] ' + SECONDARY}
                                >
                                    {selectedDay ? formatWritingDay(selectedDay) : 'Choose a day'}
                                </Text>
                                <Pressable
                                    onPress={() => stepDay(1)}
                                    disabled={!canStepForward}
                                    accessibilityRole="button"
                                    accessibilityLabel="Later day"
                                    testID="writing-year-next-day"
                                    className={
                                        'h-11 w-11 items-center justify-center rounded-control border border-hairline-light dark:border-hairline-dark' +
                                        (canStepForward ? '' : ' opacity-40')
                                    }
                                >
                                    <MaterialIcons name="chevron-right" size={22} color={ink} />
                                </Pressable>
                            </View>

                            <View className="mt-3 flex-row items-center justify-between">
                                <Text className={'text-[12px] ' + SECONDARY}>
                                    Swipe to see earlier days
                                </Text>
                                <View className="flex-row items-center gap-[6px]">
                                    <Text className={'text-[12px] ' + SECONDARY}>Less</Text>
                                    {([0, 1, 2, 3, 4] as WritingLevel[]).map((level) => (
                                        <View key={'legend-' + level} className={'rounded-[2px] ' + LEVEL_CLASS[level]} style={{ width: 11, height: 11 }} />
                                    ))}
                                    <Text className={'text-[12px] ' + SECONDARY}>More</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Tap a square -> that day's writing, in plain language. */}
                    {selectedDay ? (
                        <View className="mt-7">
                            <View className="h-px w-full bg-hairline-light dark:bg-hairline-dark" />
                            <Text className={'mt-5 text-[18px] ' + SECONDARY} style={SERIF}>
                                {formatWritingDay(selectedDay)}
                            </Text>
                            {selected && selected.items.length > 0 ? (
                                <View className="mt-3 gap-3">
                                    {selected.items.map((item) => (
                                        <Pressable
                                            key={item.kind + '-' + item.id}
                                            onPress={() => router.push({
                                                pathname: item.kind === 'entry' ? '/entry-detail' : '/checkin-detail',
                                                params: { id: item.id },
                                            })}
                                            accessibilityRole="button"
                                            accessibilityLabel={'Open ' + item.title}
                                            testID={'writing-day-item-' + item.id}
                                            className="rounded-card border border-hairline-light bg-surface-light p-4 dark:border-hairline-dark dark:bg-surface-dark"
                                        >
                                            <View className="flex-row items-center justify-between">
                                                <Text className="text-[15px] text-text-light dark:text-text-dark" numberOfLines={1}>
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
                            ) : null}
                            <WriteOnDayButton
                                dateKey={selectedDay}
                                canWrite={canWriteOnDay(selectedDay, todayKey)}
                                hasWriting={(selected?.items.length ?? 0) > 0}
                            />
                        </View>
                    ) : (
                        <Text className={'mt-7 text-[14px] leading-[1.5] ' + SECONDARY}>
                            Every square is one day. The more you wrote, the deeper the color. Tap a square to read that day.
                        </Text>
                    )}
                    <View className="h-12" />
                </ScrollView>
            </View>
        </ScreenContainer>
    );
}
