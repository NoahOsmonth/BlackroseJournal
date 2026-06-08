import React, { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { HistoryItem } from '@/hooks/history/historyUtils';
import { useColorScheme } from '@/hooks/use-color-scheme';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];
type IconTone = 'accent' | 'blue' | 'danger' | 'muted';

interface IconSpec {
    name: MaterialIconName;
    tone: IconTone;
}

interface HistoryEntryCardProps {
    item: HistoryItem;
    onPress: () => void;
}

const SECONDARY_TEXT_CLASS = 'text-text-secondary-light dark:text-text-secondary-dark';
const CARD_CLASS = [
    'bg-surface-light dark:bg-surface-dark p-5 rounded-3xl shadow-soft',
    'border border-gray-100 dark:border-transparent',
].join(' ');

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

function resolveIcon(item: HistoryItem): IconSpec {
    if (item.type === 'checkin') {
        if (item.checkInType === 'evening') return { name: 'auto-awesome', tone: 'accent' };
        if (item.checkInType === 'morning') return { name: 'wb-sunny', tone: 'accent' };
        return { name: 'adjust', tone: 'danger' };
    }

    return { name: 'edit-note', tone: 'blue' };
}

function resolveMood(item: HistoryItem): { label: string; icon: MaterialIconName; tone: IconTone } {
    if (item.type === 'checkin') {
        if (item.checkInType === 'evening') {
            return { label: item.mood ?? 'Content', icon: 'sentiment-satisfied', tone: 'accent' };
        }
        if (item.checkInType === 'morning') {
            return { label: item.mood ?? 'Reflective', icon: 'sentiment-satisfied', tone: 'muted' };
        }
        return { label: item.mood ?? 'Reflective', icon: 'search', tone: 'muted' };
    }
    return { label: 'Reflective', icon: 'sentiment-satisfied', tone: 'muted' };
}

function resolveToneColor(tone: IconTone, isDark: boolean): string {
    const palette = {
        accent: isDark ? '#FFB454' : '#B45309',
        blue: isDark ? '#93C5FD' : '#2563EB',
        danger: isDark ? '#FCA5A5' : '#DC2626',
        muted: isDark ? '#D1D5DB' : '#6B7280',
    };
    return palette[tone];
}

export function HistoryEntryCard({ item, onPress }: HistoryEntryCardProps) {
    const isDark = useColorScheme() === 'dark';
    const label = resolveLabel(item);
    const icon = resolveIcon(item);
    const mood = resolveMood(item);
    const mutedIconColor = resolveToneColor('muted', isDark);

    return (
        <Pressable
            onPress={onPress}
            className={CARD_CLASS}
            accessibilityLabel={`Open ${item.title}`}
        >
            <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-1.5">
                    <MaterialIcons name="edit-note" size={18} color={mutedIconColor} />
                    <Text className={`text-xs font-medium ${SECONDARY_TEXT_CLASS}`}>
                        {label}
                    </Text>
                </View>
                <Text className={`text-xs font-medium ${SECONDARY_TEXT_CLASS}`}>
                    {formatTime(item.createdAt)}
                </Text>
            </View>
            <View className="flex-row items-start gap-2.5 mb-2">
                <MaterialIcons name={icon.name} size={22} color={resolveToneColor(icon.tone, isDark)} />
                <Text className="text-base font-bold text-text-light dark:text-white leading-tight flex-1">
                    {item.title}
                </Text>
            </View>
            <Text className={`text-sm ${SECONDARY_TEXT_CLASS} leading-relaxed mb-4 pl-[34px]`}>
                {item.summary}
            </Text>
            <View className={`flex-row items-center gap-1.5 ${SECONDARY_TEXT_CLASS} pl-[34px]`}>
                <MaterialIcons
                    name={mood.icon}
                    size={16}
                    color={resolveToneColor(mood.tone, isDark)}
                />
                <Text className={`text-xs font-medium ${SECONDARY_TEXT_CLASS}`}>
                    {mood.label}
                </Text>
            </View>
        </Pressable>
    );
}
