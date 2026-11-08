import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNavBack } from '@/hooks/navigation/useNavBack';
import { useWritingYear } from '@/hooks/insights/useWritingYear';
import type { WritingDay, WritingLevel } from '@/utils/writingYear';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };
const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const SECONDARY = 'text-text-secondary-light dark:text-text-secondary-dark';

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
    const parts = ['aspect-square w-full rounded-[2px]', LEVEL_CLASS[day.level]];
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

/**
 * A year of writing: 53 Sunday-first columns of seven small squares. One
 * serif moment (the title), one quiet legend, all data from the local journal.
 * No network, no AI, no new storage key.
 */
export default function WritingYearScreen() {
    const goBack = useNavBack('/streak-view');
    const isDark = useColorScheme() === 'dark';
    const ink = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const { grid, isLoading } = useWritingYear();

    const rangeLabel = useMemo(() => {
        const fmt = (key: string) => new Date(key + 'T12:00:00')
            .toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        return fmt(grid.startDateKey) + ' to ' + fmt(grid.endDateKey);
    }, [grid.startDateKey, grid.endDateKey]);

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
                            <View className="mb-2 h-4 w-full">
                                {grid.monthLabels.map((month) => (
                                    <Text
                                        key={month.label + '-' + month.weekIndex}
                                        className={'absolute text-[11px] ' + SECONDARY}
                                        style={{ left: `${(month.weekIndex / grid.weeksCount) * 100}%` }}
                                    >
                                        {month.label}
                                    </Text>
                                ))}
                            </View>

                            <View className="flex-row gap-[3px]">
                                <View className="mr-1 justify-between py-[1px]">
                                    {WEEKDAY_INITIALS.map((initial, index) => (
                                        <Text
                                            key={'weekday-' + index}
                                            className={'h-[13px] text-[10px] leading-[13px] ' + SECONDARY}
                                        >
                                            {index % 2 === 1 ? initial : ''}
                                        </Text>
                                    ))}
                                </View>
                                <View className="flex-1 flex-row gap-[3px]">
                                    {grid.weeks.map((week, weekIndex) => (
                                        <View key={'week-' + weekIndex} className="flex-1 gap-[3px]">
                                            {week.map((day) => (
                                                <View
                                                    key={day.dateKey}
                                                    accessibilityLabel={dayAccessibilityLabel(day)}
                                                    className={dayClass(day)}
                                                    testID={day.isToday ? 'writing-year-today' : undefined}
                                                />
                                            ))}
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </View>
                    )}

                    <View className="mt-6 flex-row items-center justify-end gap-[6px]">
                        <Text className={'mr-1 text-[12px] ' + SECONDARY}>Less</Text>
                        {([0, 1, 2, 3, 4] as WritingLevel[]).map((level) => (
                            <View key={'legend-' + level} className={'h-[13px] w-[13px] rounded-[2px] ' + LEVEL_CLASS[level]} />
                        ))}
                        <Text className={'ml-1 text-[12px] ' + SECONDARY}>More</Text>
                    </View>

                    <Text className={'mt-6 pb-10 text-[14px] leading-[1.5] ' + SECONDARY}>
                        Every square is one day. The more you wrote, the deeper the color.
                    </Text>
                </ScrollView>
            </View>
        </ScreenContainer>
    );
}
