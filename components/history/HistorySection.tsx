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
        <View className="mb-8 pl-10 relative">
            {/* Timeline Dot Node */}
            <View className="absolute left-[11px] top-[4px] w-2.5 h-2.5 rounded-full bg-primary border-[2px] border-background-light dark:border-background-dark z-10" />

            <View className="mb-4">
                <Text className="text-[10px] font-bold tracking-[0.15em] uppercase text-text-secondary-light dark:text-text-secondary-dark">
                    {label}
                </Text>
            </View>
            
            <View className="flex-col gap-4">
                {items.map((item) => (
                    <View key={item.id} className="relative">
                        {/* Horizontal timeline bridge to the card */}
                        <View className="absolute left-[-24px] top-[31px] w-[24px] h-[1.5px] bg-divider-light dark:bg-divider-dark z-0" />
                        
                        <HistoryEntryCard
                            item={item}
                            onPress={() => onPressItem(item)}
                        />
                    </View>
                ))}
            </View>
        </View>
    );
}
