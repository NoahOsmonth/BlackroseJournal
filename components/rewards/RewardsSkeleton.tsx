import React from 'react';
import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { SkeletonText } from '@/components/ui/SkeletonText';
import { LoadingStatus } from '@/components/ui/LoadingStatus';

/** Mirrors the streak card + achievements grid of app/rewards.tsx. */
export function RewardsSkeleton() {
    return (
        <View className="gap-4" accessibilityLabel="Loading rewards">
            <LoadingStatus label="Loading rewards" compact />

            {/* Streak card */}
            <View className="p-6 rounded-2xl bg-surface-light dark:bg-surface-dark">
                <View className="flex-row items-center justify-between mb-4">
                    <Skeleton className="h-14 w-14 rounded-lg" accessibilityLabel="Loading streak emoji" />
                    <View className="items-end gap-2">
                        <Skeleton className="h-9 w-16" accessibilityLabel="Loading current streak" />
                        <Skeleton className="h-3 w-20" accessibilityLabel="Loading current streak label" />
                    </View>
                </View>
                <View className="border-t border-divider-light dark:border-divider-dark pt-4">
                    <SkeletonText lines={1} className="gap-0" accessibilityLabel="Loading longest streak" />
                </View>
            </View>

            {/* Achievements header */}
            <View className="flex-row items-center justify-between">
                <Skeleton className="h-5 w-28" accessibilityLabel="Loading achievements title" />
                <Skeleton className="h-4 w-24" accessibilityLabel="Loading achievements count" />
            </View>

            {/* Achievements grid */}
            <View className="flex-row flex-wrap -mx-2">
                {[1, 2, 3, 4, 5, 6].map((index) => (
                    <View key={index} className="w-1/3 p-2">
                        <View className="h-28 p-4 rounded-xl items-center bg-surface-light dark:bg-surface-dark">
                            <Skeleton className="h-8 w-8 rounded-md" accessibilityLabel={`Loading achievement ${index} icon`} />
                            <Skeleton className="h-3 w-16 mt-3" accessibilityLabel={`Loading achievement ${index} title`} />
                            <Skeleton className="h-2 w-full mt-3 rounded-full" accessibilityLabel={`Loading achievement ${index} progress`} />
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}