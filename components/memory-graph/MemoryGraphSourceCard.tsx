import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { SkeletonText } from '@/components/ui/SkeletonText';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { MemorySourcePreview } from '@/services/memory/memoryGraph.types';

interface SourceCardProps {
    preview: MemorySourcePreview | null;
    isLoading: boolean;
    missing: boolean;
    onOpen: () => void;
}

export function MemoryGraphSourceCard({
    preview,
    isLoading,
    missing,
    onOpen,
}: SourceCardProps) {
    const colorScheme = useColorScheme();
    const iconColor = colorScheme === 'dark' ? Colors.dark.icon : Colors.light.icon;
    const accentColor = Colors.light.tint;

    if (isLoading) {
        return (
            <View
                className="mt-4 gap-3 rounded-2xl border border-divider-light bg-background-light p-3 dark:border-divider-dark dark:bg-background-dark"
                accessibilityLabel="Loading source"
            >
                <Skeleton className="h-3 w-16" accessibilityLabel="Loading source label" />
                <SkeletonText lines={2} lineClassName="h-4" accessibilityLabel="Loading source title" />
                <Skeleton className="h-3 w-32" accessibilityLabel="Loading source metadata" />
                <SkeletonText lines={2} lineClassName="h-3" accessibilityLabel="Loading source snippet" />
            </View>
        );
    }

    if (missing) {
        return (
            <View className="mt-4 rounded-2xl border border-divider-light dark:border-divider-dark bg-background-light dark:bg-background-dark p-3">
                <Text className="text-xs font-bold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
                    Source
                </Text>
                <Text className="mt-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    Source no longer available.
                </Text>
            </View>
        );
    }

    if (!preview) {
        return null;
    }

    const kindLabel = preview.kind === 'journal_entry' ? 'Journal' : 'Check-in';
    const metaParts = [
        preview.dateLabel,
        kindLabel,
        preview.messageCount > 0 ? `${preview.messageCount} messages` : null,
        preview.mood,
    ].filter(Boolean);

    return (
        <Pressable
            accessibilityLabel="Open conversation"
            accessibilityRole="button"
            className="mt-4 overflow-hidden rounded-2xl border border-divider-light dark:border-divider-dark bg-background-light dark:bg-background-dark"
            onPress={onOpen}
        >
            <View className="gap-2 p-3">
                <Text className="text-xs font-bold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
                    Source
                </Text>
                <View className="flex-row items-start gap-2">
                    {preview.emoji ? (
                        <Text className="text-xl text-text-light dark:text-text-dark">
                            {preview.emoji}
                        </Text>
                    ) : (
                        <MaterialIcons
                            name={preview.kind === 'journal_entry' ? 'menu-book' : 'flag'}
                            size={20}
                            color={iconColor}
                        />
                    )}
                    <View className="min-w-0 flex-1 gap-1">
                        <Text
                            className="text-sm font-semibold text-text-light dark:text-text-dark"
                            numberOfLines={2}
                        >
                            {preview.title}
                        </Text>
                        <Text
                            className="text-xs text-text-secondary-light dark:text-text-secondary-dark"
                            numberOfLines={1}
                        >
                            {metaParts.join(' · ')}
                        </Text>
                        {preview.intentionTitle ? (
                            <Text
                                className="text-xs text-text-secondary-light dark:text-text-secondary-dark"
                                numberOfLines={1}
                            >
                                Intention: {preview.intentionTitle}
                            </Text>
                        ) : null}
                        {preview.snippet ? (
                            <Text
                                className="mt-1 text-sm leading-5 text-text-secondary-light dark:text-text-secondary-dark"
                                numberOfLines={2}
                            >
                                “{preview.snippet}”
                            </Text>
                        ) : null}
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color={iconColor} />
                </View>
                <View className="flex-row items-center gap-1 pt-1">
                    <Text className="text-sm font-semibold text-primary dark:text-primary">
                        Open conversation
                    </Text>
                    <MaterialIcons name="arrow-forward" size={16} color={accentColor} />
                </View>
            </View>
        </Pressable>
    );
}
