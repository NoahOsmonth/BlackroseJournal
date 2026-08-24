import React from 'react';
import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { SkeletonText } from '@/components/ui/SkeletonText';
import { LoadingStatus } from '@/components/ui/LoadingStatus';

/** Mirrors the layout of app/(tabs)/today.tsx: header, actions, intentions, goals, insight. */
export function TodaySkeleton() {
    return (
        <View className="flex-1 gap-6 px-4" accessibilityLabel="Loading today screen">
            <LoadingStatus label="Loading your day" compact />

            {/* WeekdaySelector area */}
            <View className="flex-row gap-2 h-10 items-center">
                {[1, 2, 3, 4, 5, 6, 7].map((index) => (
                    <Skeleton key={index} className="flex-1 h-10 rounded-xl" accessibilityLabel={`Loading day ${index}`} />
                ))}
            </View>

            {/* Today date label */}
            <Skeleton className="h-4 w-24 self-center" accessibilityLabel="Loading date" />

            {/* Morning/Evening action cards */}
            <View className="flex-row gap-4">
                <View className="flex-1 gap-3 p-5 rounded-2xl bg-surface-light dark:bg-surface-dark">
                    <Skeleton className="h-12 w-12 rounded-xl" accessibilityLabel="Loading morning icon" />
                    <Skeleton className="h-5 w-20" accessibilityLabel="Loading morning title" />
                    <Skeleton className="h-4 w-24" accessibilityLabel="Loading morning subtitle" />
                </View>
                <View className="flex-1 gap-3 p-5 rounded-2xl bg-surface-light dark:bg-surface-dark">
                    <Skeleton className="h-12 w-12 rounded-xl" accessibilityLabel="Loading evening icon" />
                    <Skeleton className="h-5 w-20" accessibilityLabel="Loading evening title" />
                    <Skeleton className="h-4 w-24" accessibilityLabel="Loading evening subtitle" />
                </View>
            </View>

            {/* MyIntentionsSection */}
            <View className="gap-3">
                <Skeleton className="h-3 w-20 self-start" accessibilityLabel="Loading intentions header" />
                <View className="gap-3">
                    {[1, 2].map((index) => (
                        <View key={index} className="p-4 rounded-2xl bg-surface-light dark:bg-surface-dark gap-2">
                            <View className="flex-row items-center justify-between">
                                <Skeleton className="h-5 w-32" accessibilityLabel={`Loading intention ${index}`} />
                                <Skeleton className="h-8 w-24 rounded-xl" accessibilityLabel={`Loading intention action ${index}`} />
                            </View>
                            <SkeletonText lines={1} lineClassName="h-3" lastLineClassName="w-3/4" accessibilityLabel={`Loading intention detail ${index}`} />
                        </View>
                    ))}
                </View>
            </View>

            {/* GoalsSection */}
            <View className="gap-3">
                <View className="flex-row items-center justify-between">
                    <Skeleton className="h-3 w-16" accessibilityLabel="Loading goals header" />
                    <Skeleton className="h-6 w-12 rounded-lg" accessibilityLabel="Loading add goal button" />
                </View>
                <View className="gap-3">
                    {[1, 2, 3].map((index) => (
                        <View key={index} className="flex-row items-center justify-between p-4 rounded-2xl bg-surface-light dark:bg-surface-dark">
                            <Skeleton className="h-5 w-40" accessibilityLabel={`Loading goal ${index}`} />
                            <Skeleton className="h-6 w-6 rounded-full" accessibilityLabel={`Loading goal toggle ${index}`} />
                        </View>
                    ))}
                </View>
            </View>

            {/* EntryInsightsCard */}
            <View className="p-5 rounded-2xl bg-surface-light dark:bg-surface-dark gap-3">
                <Skeleton className="h-4 w-24" accessibilityLabel="Loading insight label" />
                <SkeletonText lines={2} accessibilityLabel="Loading insight question" />
                <View className="flex-row items-center justify-between">
                    <Skeleton className="h-8 w-28 rounded-xl" accessibilityLabel="Loading insight action" />
                    <Skeleton className="h-8 w-28 rounded-xl" accessibilityLabel="Loading insight more" />
                </View>
            </View>
        </View>
    );
}