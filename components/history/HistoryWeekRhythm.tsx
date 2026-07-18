import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
    ReduceMotion,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
} from 'react-native-reanimated';

import type { WeeklyHistorySummary } from '@/hooks/history/historyUtils';
import {
    formatWeekProse,
    getWeekdayMonograms,
    toDateKey,
} from '@/hooks/history/historyUtils';

interface HistoryWeekRhythmProps {
    summary: WeeklyHistorySummary;
    now?: Date;
}

const DOT_SPRING = {
    stiffness: 220,
    damping: 18,
    mass: 0.8,
    reduceMotion: ReduceMotion.System,
};

function DayCell({
    monogram,
    dateKey,
    active,
    isToday,
    index,
}: {
    monogram: string;
    dateKey: string;
    active: boolean;
    isToday: boolean;
    index: number;
}) {
    const scale = useSharedValue(active ? 0.4 : 1);
    const opacity = useSharedValue(active ? 0 : 1);

    useEffect(() => {
        if (!active) return;
        scale.value = withDelay(index * 40, withSpring(1, DOT_SPRING));
        opacity.value = withDelay(index * 40, withSpring(1, DOT_SPRING));
    }, [active, index, opacity, scale]);

    const dotStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    return (
        <View className="flex-1 items-center gap-1.5" accessibilityLabel={`${dateKey}${active ? ', has entries' : ''}`}>
            <Text
                className={`text-[11px] font-medium ${
                    isToday
                        ? 'text-primary dark:text-primary-dark'
                        : 'text-text-secondary-light dark:text-text-secondary-dark'
                }`}
            >
                {monogram}
            </Text>
            <View
                className={`h-2.5 w-2.5 items-center justify-center rounded-full ${
                    isToday ? 'border border-primary dark:border-primary-dark' : ''
                }`}
            >
                {active ? (
                    <Animated.View
                        style={dotStyle}
                        className="h-1.5 w-1.5 rounded-full bg-primary dark:bg-primary-dark"
                    />
                ) : (
                    <View className="h-1 w-1 rounded-full bg-divider-light dark:bg-divider-dark" />
                )}
            </View>
        </View>
    );
}

export function HistoryWeekRhythm({ summary, now = new Date() }: HistoryWeekRhythmProps) {
    const monograms = getWeekdayMonograms();
    const todayKey = toDateKey(now.getTime());
    const activeSet = new Set(summary.activeDayKeys);
    const prose = formatWeekProse(summary);
    const weekKeys = summary.weekDayKeys.length === 7
        ? summary.weekDayKeys
        : Array.from({ length: 7 }, () => '');

    return (
        <View
            className="rounded-2xl border border-divider-light dark:border-divider-dark bg-surface-light dark:bg-surface-dark px-3 py-3"
            accessibilityLabel={
                prose
                    ? `This week: ${prose}`
                    : 'This week has no history items yet'
            }
        >
            <View className="flex-row items-center">
                {weekKeys.map((dateKey, index) => (
                    <DayCell
                        key={dateKey || `day-${index}`}
                        monogram={monograms[index] ?? ''}
                        dateKey={dateKey}
                        active={activeSet.has(dateKey)}
                        isToday={dateKey === todayKey}
                        index={index}
                    />
                ))}
            </View>
            {prose ? (
                <Text className="mt-3 text-center text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
                    {prose}
                </Text>
            ) : null}
        </View>
    );
}
