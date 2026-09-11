import React from 'react';
import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { SkeletonText } from '@/components/ui/SkeletonText';
import { LoadingStatus } from '@/components/ui/LoadingStatus';

/** Mirrors the layout of app/(tabs)/today.tsx: date headline, write card, rows. */
export function TodaySkeleton() {
    return (
        <View className="flex-1 gap-6 px-6" accessibilityLabel="Loading today screen">
            <LoadingStatus label="Loading your day" compact />

            {/* Serif date headline */}
            <Skeleton className="h-10 w-44" accessibilityLabel="Loading date" />

            {/* Weekday row */}
            <View className="flex-row gap-2 h-8 items-center">
                {[1, 2, 3, 4, 5, 6, 7].map((index) => (
                    <Skeleton key={index} className="flex-1 h-8 rounded-control" accessibilityLabel={`Loading day ${index}`} />
                ))}
            </View>

            {/* Writing surface */}
            <View className="rounded-card border border-hairline-light dark:border-hairline-dark p-5 gap-4 min-h-[168px]">
                <Skeleton className="h-5 w-52" accessibilityLabel="Loading writing prompt" />
                <Skeleton className="h-5 w-px" accessibilityLabel="Loading caret" />
            </View>

            {/* Morning / evening ritual rows */}
            <View className="gap-3">
                {[1, 2].map((index) => (
                    <View key={index} className="flex-row items-center justify-between py-1">
                        <Skeleton className="h-5 w-32" accessibilityLabel={`Loading ritual ${index}`} />
                        <Skeleton className="h-4 w-12" accessibilityLabel={`Loading ritual state ${index}`} />
                    </View>
                ))}
            </View>

            {/* Intentions rows */}
            <View className="gap-3">
                <Skeleton className="h-3 w-20 self-start" accessibilityLabel="Loading intentions header" />
                {[1, 2, 3].map((index) => (
                    <View key={index} className="gap-3">
                        <Skeleton className="h-5 w-56" accessibilityLabel={`Loading intention ${index}`} />
                        <View className="h-px bg-hairline-light dark:bg-hairline-dark" />
                    </View>
                ))}
            </View>

            {/* Goals rows */}
            <View className="gap-3">
                <Skeleton className="h-3 w-16 self-start" accessibilityLabel="Loading goals header" />
                {[1, 2].map((index) => (
                    <View key={index} className="flex-row items-center justify-between">
                        <Skeleton className="h-5 w-40" accessibilityLabel={`Loading goal ${index}`} />
                        <Skeleton className="h-6 w-6 rounded-full" accessibilityLabel={`Loading goal toggle ${index}`} />
                    </View>
                ))}
            </View>

            {/* EntryInsightsCard */}
            <View className="rounded-card bg-surface-light dark:bg-surface-dark p-5 gap-3">
                <Skeleton className="h-4 w-24" accessibilityLabel="Loading insight label" />
                <SkeletonText lines={2} accessibilityLabel="Loading insight question" />
                <View className="flex-row items-center justify-between">
                    <Skeleton className="h-8 w-28 rounded-control" accessibilityLabel="Loading insight action" />
                    <Skeleton className="h-8 w-28 rounded-control" accessibilityLabel="Loading insight more" />
                </View>
            </View>
        </View>
    );
}
