import React from 'react';
import { Text, View } from 'react-native';

import { HistoryItem, HistorySection as HistorySectionModel } from '@/hooks/history/historyUtils';
import { HistoryEntryCard } from './HistoryEntryCard';

interface HistorySectionProps {
    section: HistorySectionModel;
    onPressItem: (item: HistoryItem) => void;
}

export function HistorySection({ section, onPressItem }: HistorySectionProps) {
    const dayLabel = section.relativeLabel === 'today'
        ? 'Today'
        : section.relativeLabel === 'yesterday'
            ? 'Yesterday'
            : section.weekdayShort;

    return (
        <View className="gap-3">
            <View className="flex-row items-end gap-2.5 px-0.5">
                <Text
                    className="text-[28px] leading-none font-bold text-text-light dark:text-text-dark"
                    style={{ fontFamily: 'PlayfairDisplayBold' }}
                >
                    {section.dayNumber}
                </Text>
                <View className="pb-0.5">
                    <Text className="text-sm font-semibold text-text-light dark:text-text-dark">
                        {dayLabel}
                    </Text>
                </View>
            </View>

            <View className="overflow-hidden rounded-2xl border border-divider-light dark:border-divider-dark bg-surface-light dark:bg-surface-dark">
                {section.items.map((item, index) => (
                    <HistoryEntryCard
                        key={item.id}
                        item={item}
                        isLast={index === section.items.length - 1}
                        onPress={() => onPressItem(item)}
                    />
                ))}
            </View>
        </View>
    );
}
