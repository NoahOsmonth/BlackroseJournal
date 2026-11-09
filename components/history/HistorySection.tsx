import React from 'react';
import { Text, View } from 'react-native';

import { HistoryItem, HistorySection as HistorySectionModel } from '@/hooks/history/historyUtils';
import { HistoryEntryCard } from './HistoryEntryCard';

interface HistorySectionProps {
    section: HistorySectionModel;
    onPressItem: (item: HistoryItem) => void;
    /** Ids of entries the writer starred; a star mark is drawn on those rows. */
    starredIds?: ReadonlySet<string>;
    /** Ids currently picked in selection mode; `undefined` turns the mode off. */
    selectedIds?: ReadonlySet<string>;
}

/**
 * A day group in Archive: serif day heading ("Today · January 23"), then the
 * day's entry cards as separate surfaces. There is no wrapping card container —
 * the concept shows each entry as its own panel on the void.
 */
export function HistorySection({ section, onPressItem, starredIds, selectedIds }: HistorySectionProps) {
    const dayLabel = section.relativeLabel === 'today'
        ? 'Today'
        : section.relativeLabel === 'yesterday'
            ? 'Yesterday'
            : section.weekdayShort;

    const heading = `${dayLabel} · ${section.monthLabel} ${section.dayNumber}`;

    return (
        <View className="gap-4">
            <Text
                className="text-[16px] text-text-light dark:text-text-dark"
                style={{ fontFamily: 'PlayfairDisplayRegular' }}
                accessibilityRole="header"
            >
                {heading}
            </Text>

            <View>
                {section.items.map((item, index) => (
                    <HistoryEntryCard
                        key={item.id}
                        item={item}
                        isLast={index === section.items.length - 1}
                        onPress={() => onPressItem(item)}
                        isStarred={Boolean(starredIds?.has(item.sourceId))}
                        selected={selectedIds && item.type === 'journal'
                            ? selectedIds.has(item.sourceId)
                            : undefined}
                    />
                ))}
            </View>
        </View>
    );
}
