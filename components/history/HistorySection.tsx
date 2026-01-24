import React from 'react';
import { Text, View } from 'react-native';
import { HistoryItem } from '@/hooks/history/historyUtils';
import { HistoryEntryCard } from './HistoryEntryCard';

interface HistorySectionProps {
    label: string;
    items: HistoryItem[];
    onPressItem: (item: HistoryItem) => void;
}

export function HistorySection({ label, items, onPressItem }: HistorySectionProps) {
    return (
        <View className="mb-6">
            <View className="items-center mb-5">
                <Text className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
                    {label}
                </Text>
            </View>
            <View className="flex-col gap-4">
                {items.map((item) => (
                    <HistoryEntryCard
                        key={item.id}
                        item={item}
                        onPress={() => onPressItem(item)}
                    />
                ))}
            </View>
        </View>
    );
}
