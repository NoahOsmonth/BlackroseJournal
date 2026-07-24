import React from 'react';
import { Text, View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { SkeletonText } from '@/components/ui/SkeletonText';
import type { JournalEntryAnalysis } from '@/services/journal/journalStorage.types';

interface EntryAnalysisPanelProps {
    analysis?: JournalEntryAnalysis;
    isLoading?: boolean;
}

export function EntryAnalysisPanel({ analysis, isLoading = false }: EntryAnalysisPanelProps) {
    if (isLoading && !analysis) {
        return (
            <View className="gap-4 rounded-2xl bg-surface-light dark:bg-surface-dark p-5" accessibilityLabel="Loading analysis">
                <Skeleton className="h-3 w-16" accessibilityLabel="Loading analysis label" />
                <Skeleton className="h-3 w-12" accessibilityLabel="Loading insight label" />
                <SkeletonText lines={2} accessibilityLabel="Loading analysis insight" />
                <Skeleton className="h-3 w-12" accessibilityLabel="Loading quote label" />
                <SkeletonText lines={2} accessibilityLabel="Loading analysis quote" />
                <Skeleton className="h-3 w-28" accessibilityLabel="Loading mood topics label" />
                <Skeleton className="h-4 w-20" accessibilityLabel="Loading analysis mood" />
                <View className="flex-row gap-2">
                    {[1, 2, 3].map((index) => (
                        <Skeleton key={index} className="h-6 w-16 rounded-full" accessibilityLabel={`Loading analysis topic ${index}`} />
                    ))}
                </View>
            </View>
        );
    }

    if (!analysis) return null;
    const quote = `"${analysis.quote}"`;

    return (
        <View className="rounded-2xl bg-surface-light dark:bg-surface-dark p-5">
            <Text className="text-xs font-bold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
                Analysis
            </Text>

            <View className="mt-4">
                <Text className="text-xs font-bold uppercase tracking-wide text-primary">
                    Insight
                </Text>
                <Text className="mt-1 text-base leading-6 text-text-light dark:text-text-dark">
                    {analysis.insight}
                </Text>
            </View>

            <View className="mt-4">
                <Text className="text-xs font-bold uppercase tracking-wide text-primary">
                    Quote
                </Text>
                <Text className="mt-1 text-base italic leading-6 text-text-light dark:text-text-dark">
                    {quote}
                </Text>
            </View>

            <View className="mt-4">
                <Text className="text-xs font-bold uppercase tracking-wide text-primary">
                    Mood & Topics
                </Text>
                <Text className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    {analysis.mood}
                </Text>
                <View className="mt-3 flex-row flex-wrap gap-2">
                    {analysis.topics.map((topic) => (
                        <View
                            key={topic}
                            className="rounded-full bg-primary/10 px-3 py-1.5 dark:bg-primary/20"
                        >
                            <Text className="text-xs font-semibold text-primary">
                                {topic}
                            </Text>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}
