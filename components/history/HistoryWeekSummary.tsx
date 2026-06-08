import React, { ComponentProps } from 'react';
import { Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import type { WeeklyHistorySummary } from '@/hooks/history/historyUtils';

interface HistoryWeekSummaryProps {
    summary: WeeklyHistorySummary;
}

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

interface SummaryMetric {
    label: string;
    value: string | number;
    icon: MaterialIconName;
}

const SECONDARY_TEXT_CLASS = 'text-text-secondary-light dark:text-text-secondary-dark';

function buildMetrics(summary: WeeklyHistorySummary): SummaryMetric[] {
    return [
        { label: 'Entries', value: summary.journalCount, icon: 'edit-note' },
        { label: 'Check-ins', value: summary.checkInCount, icon: 'wb-sunny' },
        { label: 'Active days', value: summary.activeDays, icon: 'calendar-today' },
    ];
}

function formatSignals(signals: readonly string[]): string {
    if (signals.length === 0) return 'quiet, reflective, open';
    return signals.map((signal) => signal[0].toUpperCase() + signal.slice(1)).join(' / ');
}

export function HistoryWeekSummary({ summary }: HistoryWeekSummaryProps) {
    const isDark = useColorScheme() === 'dark';
    const accentColor = isDark ? '#FFB454' : '#B45309';
    const metrics = buildMetrics(summary);

    return (
        <View
            className="bg-surface-light dark:bg-surface-dark border-[0.5px] border-divider-light dark:border-divider-dark rounded-3xl p-6 mb-6 relative overflow-hidden"
            accessibilityLabel={`This week has ${summary.itemCount} history items`}
        >
            <View className="flex-row items-center justify-between mb-5">
                <View>
                    <Text className={`text-[10px] font-bold tracking-[0.15em] uppercase ${SECONDARY_TEXT_CLASS} mb-1`}>
                        This week
                    </Text>
                    <Text className="text-base font-bold tracking-tight text-text-main-light dark:text-text-main-dark">
                        {summary.label}
                    </Text>
                </View>
                <View className="flex-row items-center gap-1.5 bg-primary/10 dark:bg-primary-dark/20 px-3 py-1 rounded-full border-[0.5px] border-primary/20">
                    <MaterialIcons name="auto-awesome" size={13} color={accentColor} />
                    <Text className="text-xs font-bold text-primary dark:text-primary-dark">
                        {summary.itemCount}
                    </Text>
                </View>
            </View>

            <View className="flex-row items-center justify-between mb-5 py-2 border-y border-divider-light/60 dark:border-divider-dark/60">
                {metrics.map((metric, idx) => (
                    <View
                        key={metric.label}
                        className={`items-center flex-1 ${idx < metrics.length - 1 ? 'border-r border-divider-light dark:border-divider-dark' : ''}`}
                    >
                        <Text className="text-2xl font-bold tracking-tight text-text-main-light dark:text-text-main-dark leading-none mb-1">
                            {metric.value}
                        </Text>
                        <Text className={`text-[10px] font-bold tracking-wider uppercase ${SECONDARY_TEXT_CLASS}`}>
                            {metric.label}
                        </Text>
                    </View>
                ))}
            </View>

            <View className="flex-row items-center gap-2 mt-1">
                <View className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
                <View className="flex-row items-center flex-1 flex-wrap">
                    <Text className={`text-[10px] font-bold tracking-wider uppercase ${SECONDARY_TEXT_CLASS} mr-2`}>
                        Signals:
                    </Text>
                    <Text className="text-xs font-semibold text-text-main-light dark:text-text-main-dark tracking-wide">
                        {formatSignals(summary.topSignals)}
                    </Text>
                </View>
            </View>
        </View>
    );
}
