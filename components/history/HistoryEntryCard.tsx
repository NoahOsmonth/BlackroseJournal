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
    'bg-surface-light dark:bg-surface-dark p-5 rounded-3xl',
    'border-[0.5px] border-divider-light dark:border-divider-dark relative overflow-hidden',
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

function resolveAccentColorClass(item: HistoryItem): string {
    if (item.type === 'checkin') {
        if (item.checkInType === 'evening') return 'bg-persona-rose';
        if (item.checkInType === 'morning') return 'bg-primary';
        return 'bg-persona-teal';
    }
    return 'bg-accent-blue';
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
            {/* Z-Axis Left Accent Strip representing type */}
            <View className={`absolute left-0 top-0 bottom-0 w-[4px] ${resolveAccentColorClass(item)}`} />

            <View className="flex-col">
                {/* Header Row: Category Label and Time */}
                <View className="flex-row items-center justify-between mb-3.5 pl-1">
                    <View className="flex-row items-center gap-1.5">
                        <MaterialIcons name="edit-note" size={14} color={mutedIconColor} />
                        <Text className={`text-[10px] font-bold uppercase tracking-wider ${SECONDARY_TEXT_CLASS}`}>
                            {label}
                        </Text>
                    </View>
                    <Text className={`text-[10px] font-medium tracking-wide ${SECONDARY_TEXT_CLASS}`}>
                        {formatTime(item.createdAt)}
                    </Text>
                </View>

                {/* Title and Icon Row */}
                <View className="flex-row items-start gap-3 mb-2.5">
                    <View className="pt-0.5">
                        <MaterialIcons name={icon.name} size={22} color={resolveToneColor(icon.tone, isDark)} />
                    </View>
                    <Text className="text-base font-bold tracking-tight text-text-light dark:text-white leading-snug flex-1">
                        {item.title}
                    </Text>
                </View>

                {/* Summary Text */}
                <Text className={`text-sm ${SECONDARY_TEXT_CLASS} leading-relaxed mb-4 pl-[34px]`}>
                    {item.summary}
                </Text>

                {/* Mood Capsule Badge */}
                <View className="flex-row items-center gap-1.5 pl-[34px]">
                    <View className="flex-row items-center gap-1.5 bg-gray-150/40 dark:bg-divider-dark/40 border-[0.5px] border-divider-light dark:border-divider-dark px-2.5 py-1 rounded-full">
                        <MaterialIcons
                            name={mood.icon}
                            size={13}
                            color={resolveToneColor(mood.tone, isDark)}
                        />
                        <Text className={`text-xs font-medium ${SECONDARY_TEXT_CLASS}`}>
                            {mood.label}
                        </Text>
                    </View>
                </View>
            </View>
        </Pressable>
    );
}
