import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNavBack } from '@/hooks/navigation/useNavBack';
import { useWritingGoal } from '@/hooks/insights/useWritingGoal';
import {
    REST_DAY_OPTIONS,
    WORD_TARGET_OPTIONS,
    type WritingGoalDay,
    type WritingGoalDayState,
} from '@/utils/writingGoal';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };
const SECONDARY = 'text-text-secondary-light dark:text-text-secondary-dark';

/** Fixed-size cells, shared by the strip and its labels (round 36/37 lesson). */
const CELL = 36;
const GAP = 4;
const COLUMNS = 7;
const STRIP_WIDTH = COLUMNS * CELL + (COLUMNS - 1) * GAP;

function cellClass(state: WritingGoalDayState): string {
    const base = 'items-center justify-center rounded-[3px]';
    if (state === 'met') return base + ' bg-bone-light dark:bg-bone-dark';
    if (state === 'light') return base + ' bg-starred-gold/60 dark:bg-starred-gold-dark/60';
    if (state === 'rest') return base + ' border border-dashed border-hairline-light bg-surface-light dark:border-hairline-dark dark:bg-surface-dark';
    if (state === 'pending') return base + ' border border-starred-gold bg-surface-2-light dark:border-starred-gold-dark dark:bg-surface-2-dark';
    return base + ' bg-surface-2-light dark:bg-surface-2-dark';
}

function cellTextClass(state: WritingGoalDayState): string {
    if (state === 'met' || state === 'light') return 'text-[12px] text-on-bone-light dark:text-on-bone-dark';
    return 'text-[12px] ' + SECONDARY;
}

function stateLabel(state: WritingGoalDayState): string {
    if (state === 'met') return 'goal reached';
    if (state === 'light') return 'some writing';
    if (state === 'rest') return 'rest day';
    if (state === 'pending') return 'still time today';
    return 'no writing';
}

/**
 * A gentle writing goal: 2026 products advertise a streak that survives rest
 * days (Be Write, Writing Tracker, TrackBear, Fortelling). Everything is local
 * and plain-language; no AI, no network, no native build.
 */
export default function WritingGoalScreen() {
    const goBack = useNavBack('/(tabs)/insights');
    const isDark = useColorScheme() === 'dark';
    const ink = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const { progress, settings, isLoading, updateSettings } = useWritingGoal();

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
                        A gentle writing goal
                    </Text>
                    <View className="min-h-11 min-w-11" />
                </View>
                <View className="mt-4 h-px w-full bg-hairline-light dark:bg-hairline-dark" />

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    {isLoading ? (
                        <Text className={'mt-8 text-center text-[15px] ' + SECONDARY}>
                            Gathering your writing…
                        </Text>
                    ) : (
                        <View className="mt-6 gap-6">
                            <Text className={'text-[14px] leading-[1.6] ' + SECONDARY}>
                                Pick a small daily word target. Days off are part of the habit, so a rest day does not end your streak.
                            </Text>

                            {/* Preset pills */}
                            <View className="gap-4">
                                <View>
                                    <Text className={'mb-2 text-[13px] ' + SECONDARY}>Words each day</Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {WORD_TARGET_OPTIONS.map((words) => {
                                            const active = settings.wordsPerDay === words;
                                            return (
                                                <Pressable
                                                    key={words}
                                                    onPress={() => { void updateSettings({ wordsPerDay: words }); }}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={words + ' words each day'}
                                                    testID={'goal-words-' + words}
                                                    className={'min-h-11 justify-center rounded-control border px-4 ' + (active ? 'border-starred-gold bg-bone-light dark:border-starred-gold-dark dark:bg-bone-dark' : 'border-hairline-light dark:border-hairline-dark')}
                                                >
                                                    <Text className={'text-[14px] ' + (active ? 'text-on-bone-light dark:text-on-bone-dark' : 'text-text-light dark:text-text-dark')}>
                                                        {words}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                </View>
                                <View>
                                    <Text className={'mb-2 text-[13px] ' + SECONDARY}>Rest days each week</Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {REST_DAY_OPTIONS.map((rests) => {
                                            const active = settings.restDaysPerWeek === rests;
                                            return (
                                                <Pressable
                                                    key={rests}
                                                    onPress={() => { void updateSettings({ restDaysPerWeek: rests }); }}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={rests + ' rest days each week'}
                                                    testID={'goal-rest-' + rests}
                                                    className={'min-h-11 justify-center rounded-control border px-4 ' + (active ? 'border-starred-gold bg-bone-light dark:border-starred-gold-dark dark:bg-bone-dark' : 'border-hairline-light dark:border-hairline-dark')}
                                                >
                                                    <Text className={'text-[14px] ' + (active ? 'text-on-bone-light dark:text-on-bone-dark' : 'text-text-light dark:text-text-dark')}>
                                                        {rests}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                </View>
                            </View>

                            {/* Plain stats */}
                            <View className="flex-row justify-between" testID="goal-stats">
                                <View className="flex-1 items-center">
                                    <Text className="text-[30px] leading-none text-text-light dark:text-text-dark" style={SERIF}>
                                        {progress.currentStreak}
                                    </Text>
                                    <Text className={'mt-2 text-[12px] ' + SECONDARY}>day streak</Text>
                                </View>
                                <View className="flex-1 items-center">
                                    <Text className="text-[30px] leading-none text-text-light dark:text-text-dark" style={SERIF}>
                                        {progress.wordsThisWeek.toLocaleString()}
                                    </Text>
                                    <Text className={'mt-2 text-[12px] ' + SECONDARY}>words this week</Text>
                                </View>
                                <View className="flex-1 items-center">
                                    <Text className="text-[30px] leading-none text-text-light dark:text-text-dark" style={SERIF}>
                                        {progress.restDaysLeftThisWeek}
                                    </Text>
                                    <Text className={'mt-2 text-[12px] ' + SECONDARY}>
                                        {progress.restDaysLeftThisWeek === 1 ? 'rest day left' : 'rest days left'}
                                    </Text>
                                </View>
                            </View>

                            {/* 28-day strip, 7 fixed columns */}
                            <View testID="goal-strip" style={{ width: STRIP_WIDTH }}>
                                <View className="mb-3 flex-row" style={{ gap: GAP }}>
                                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
                                        <View key={'weekday-' + index} className="items-center" style={{ width: CELL }}>
                                            <Text className={'text-[11px] ' + SECONDARY}>{label}</Text>
                                        </View>
                                    ))}
                                </View>
                                <View className="flex-row flex-wrap" style={{ gap: GAP }}>
                                    {progress.days.map((day: WritingGoalDay) => (
                                        <View
                                            key={day.dateKey}
                                            className={cellClass(day.state)}
                                            style={{ width: CELL, height: CELL }}
                                            testID={'goal-day-' + day.dateKey}
                                            accessibilityLabel={day.dateKey + ', ' + stateLabel(day.state)}
                                        >
                                            <Text className={cellTextClass(day.state)}>{day.dayNumber}</Text>
                                        </View>
                                    ))}
                                </View>
                                <Text className={'mt-3 text-[13px] leading-[1.5] ' + SECONDARY}>
                                    A dark square means you reached your target. A gold one means you wrote a little. An outlined one is a rest day. Today has a border while there is still time to write.
                                </Text>
                            </View>

                            <View className="rounded-card border border-hairline-light bg-surface-light px-5 py-5 dark:border-hairline-dark dark:bg-surface-dark">
                                <Text className="text-[19px] text-text-light dark:text-text-dark" style={SERIF}>
                                    How rest days work
                                </Text>
                                <Text className={'mt-3 text-[14px] leading-[1.6] ' + SECONDARY} testID="goal-rest-explainer">
                                    {'You have ' + settings.restDaysPerWeek + (settings.restDaysPerWeek === 1 ? ' rest day' : ' rest days') + ' in any seven days. You only get one when you come back to writing within the next week, and you cannot save them up. ' + progress.restDaysUsed + (progress.restDaysUsed === 1 ? ' was' : ' were') + ' used this week.'}
                                </Text>
                                {progress.currentStreak === 0 ? (
                                    <Text className={'mt-3 text-[14px] leading-[1.6] ' + SECONDARY}>
                                        No streak yet. One small entry today starts a new one.
                                    </Text>
                                ) : null}
                            </View>
                        </View>
                    )}
                    <View className="h-12" />
                </ScrollView>
            </View>
        </ScreenContainer>
    );
}
