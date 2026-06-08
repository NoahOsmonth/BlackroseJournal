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
const WEEK_PANEL_CLASS = [
    'bg-surface-light dark:bg-surface-dark border border-gray-100',
    'dark:border-divider-dark rounded-3xl px-5 py-4 mb-6',
].join(' ');

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
    const iconColor = isDark ? '#F9FAFB' : '#111827';
    const accentColor = isDark ? '#FFB454' : '#B45309';
    const metrics = buildMetrics(summary);

    return (
        <View
            className={WEEK_PANEL_CLASS}
            accessibilityLabel={`This week has ${summary.itemCount} history items`}
        >
            <View className="flex-row items-center justify-between mb-4">
                <View>
                    <Text className={`text-xs font-semibold uppercase ${SECONDARY_TEXT_CLASS}`}>
                        This week
                    </Text>
                    <Text className="text-lg font-bold text-text-main-light dark:text-text-main-dark">
                        {summary.label}
                    </Text>
                </View>
                <View className="flex-row items-center gap-1">
                    <MaterialIcons name="auto-awesome" size={17} color={accentColor} />
                    <Text className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">
                        {summary.itemCount}
                    </Text>
                </View>
            </View>

            <View className="flex-row items-center justify-between mb-4">
                {metrics.map((metric) => (
                    <View key={metric.label} className="items-center flex-1">
                        <MaterialIcons name={metric.icon} size={18} color={iconColor} />
                        <Text className="text-base font-bold text-text-main-light dark:text-text-main-dark mt-1">
                            {metric.value}
                        </Text>
                        <Text className={`text-[11px] font-medium ${SECONDARY_TEXT_CLASS}`}>
                            {metric.label}
                        </Text>
                    </View>
                ))}
            </View>

            <View className="border-t border-divider-light dark:border-divider-dark pt-3">
                <Text className={`text-xs font-semibold ${SECONDARY_TEXT_CLASS}`}>
                    Signals
                </Text>
                <Text className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">
                    {formatSignals(summary.topSignals)}
                </Text>
            </View>
        </View>
    );
}
