import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { HistoryItem } from '@/hooks/history/historyUtils';

interface HistoryEntryCardProps {
    item: HistoryItem;
    onPress: () => void;
}

function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    });
}

function resolveLabel(item: HistoryItem): string {
    if (item.type === 'checkin') {
        if (item.checkInType === 'evening') return 'Evening Reflection';
        if (item.checkInType === 'morning') return 'Morning Intention';
        return 'Intention Setting';
    }

    return 'Journal Entry';
}

function resolveIcon(item: HistoryItem) {
    if (item.type === 'checkin') {
        if (item.checkInType === 'evening') return { name: 'auto-awesome', color: '#F59E0B' };
        if (item.checkInType === 'morning') return { name: 'wb-sunny', color: '#F59E0B' };
        return { name: 'adjust', color: '#EF4444' };
    }

    return { name: 'edit-note', color: '#60A5FA' };
}

function resolveMood(item: HistoryItem): { label: string; icon: string; color?: string } {
    if (item.type === 'checkin') {
        if (item.checkInType === 'evening') {
            return { label: item.mood ?? 'Content', icon: 'sentiment-satisfied', color: '#F59E0B' };
        }
        if (item.checkInType === 'morning') {
            return { label: item.mood ?? 'Reflective', icon: 'sentiment-satisfied' };
        }
        return { label: item.mood ?? 'Reflective', icon: 'search' };
    }
    return { label: 'Reflective', icon: 'sentiment-satisfied' };
}

export function HistoryEntryCard({ item, onPress }: HistoryEntryCardProps) {
    const label = resolveLabel(item);
    const icon = resolveIcon(item);
    const mood = resolveMood(item);

    return (
        <Pressable
            onPress={onPress}
            className="bg-surface-light dark:bg-surface-dark p-5 rounded-3xl shadow-soft border border-gray-100 dark:border-transparent"
            accessibilityLabel={`Open ${item.title}`}
        >
            <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-1.5">
                    <MaterialIcons name="edit-note" size={18} color="#9CA3AF" />
                    <Text className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
                        {label}
                    </Text>
                </View>
                <Text className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
                    {formatTime(item.createdAt)}
                </Text>
            </View>
            <View className="flex-row items-start gap-2.5 mb-2">
                <MaterialIcons name={icon.name as never} size={22} color={icon.color} />
                <Text className="text-base font-bold text-text-light dark:text-white leading-tight flex-1">
                    {item.title}
                </Text>
            </View>
            <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark leading-relaxed mb-4 pl-[34px]">
                {item.summary}
            </Text>
            <View className="flex-row items-center gap-1.5 text-text-secondary-light dark:text-text-secondary-dark pl-[34px]">
                <MaterialIcons
                    name={mood.icon as never}
                    size={16}
                    color={mood.color ?? '#9CA3AF'}
                />
                <Text className="text-xs font-medium">{mood.label}</Text>
            </View>
        </Pressable>
    );
}
