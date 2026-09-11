import React from 'react';
import { Text, View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { SkeletonText } from '@/components/ui/SkeletonText';
import { LoadingStatus } from '@/components/ui/LoadingStatus';
import type { JournalEntryAnalysis } from '@/services/journal/journalStorage.types';

interface EntryAnalysisPanelProps {
    analysis?: JournalEntryAnalysis;
    isLoading?: boolean;
}

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };
const LABEL = 'text-[12px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark';

export function EntryAnalysisPanel({ analysis, isLoading = false }: EntryAnalysisPanelProps) {
    if (isLoading && !analysis) {
        return (
            <View
                className="gap-4 rounded-card border border-hairline-light bg-surface-light p-5 dark:border-hairline-dark dark:bg-surface-dark"
                accessibilityLabel="Loading analysis"
            >
                <LoadingStatus label="Reading the themes in this entry" compact />
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
        <View className="rounded-card border border-hairline-light bg-surface-light p-5 dark:border-hairline-dark dark:bg-surface-dark">
            <Text className={LABEL}>Analysis</Text>

            <View className="mt-5">
                <Text className={LABEL}>Insight</Text>
                <Text
                    className="mt-2 text-[19px] leading-[29px] text-text-light dark:text-text-dark"
                    style={SERIF}
                >
                    {analysis.insight}
                </Text>
            </View>

            <View className="mt-5 border-t border-hairline-light pt-5 dark:border-hairline-dark">
                <Text className={LABEL}>Quote</Text>
                <Text
                    className="mt-2 text-[17px] leading-[27px] text-text-light dark:text-text-dark"
                    style={SERIF}
                >
                    {quote}
                </Text>
            </View>

            <View className="mt-5 border-t border-hairline-light pt-5 dark:border-hairline-dark">
                <Text className={LABEL}>Mood & Topics</Text>
                <Text className="mt-2 text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
                    {analysis.mood}
                </Text>
                <View className="mt-3 flex-row flex-wrap gap-2">
                    {analysis.topics.map((topic) => (
                        <View
                            key={topic}
                            className="rounded-control border border-hairline-light px-3 py-1.5 dark:border-hairline-dark"
                        >
                            <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                                {topic}
                            </Text>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}
