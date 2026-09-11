import React from 'react';
import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { SkeletonText } from '@/components/ui/SkeletonText';
import { LoadingStatus } from '@/components/ui/LoadingStatus';

const HAIRLINE = 'border-hairline-light dark:border-hairline-dark';

/** Mirrors the giant numeral + achievement list of app/rewards.tsx. */
export function RewardsSkeleton() {
    return (
        <View className="gap-4" accessibilityLabel="Loading rewards">
            <LoadingStatus label="Loading rewards" compact />

            {/* Giant streak numeral with its hairline-flanked "Longest" line. */}
            <View className="items-center gap-3 pt-10 pb-8">
                <Skeleton className="h-24 w-24" accessibilityLabel="Loading current streak" />
                <Skeleton className="h-4 w-24" accessibilityLabel="Loading current streak label" />
                <View className="w-full flex-row items-center gap-4">
                    <View className="h-px flex-1 bg-hairline-light dark:bg-hairline-dark" />
                    <SkeletonText lines={1} className="gap-0" accessibilityLabel="Loading longest streak" />
                    <View className="h-px flex-1 bg-hairline-light dark:bg-hairline-dark" />
                </View>
            </View>

            <Skeleton className="h-6 w-40" accessibilityLabel="Loading achievements title" />

            {/* Achievement rows — one medallion + title each, hairline-divided. */}
            <View className={`overflow-hidden rounded-card border ${HAIRLINE}`}>
                {[1, 2, 3, 4, 5, 6].map((index) => (
                    <View
                        key={index}
                        className="min-h-16 flex-row items-center gap-4 px-4 py-3.5"
                    >
                        <Skeleton
                            className="h-11 w-11 rounded-full"
                            accessibilityLabel={`Loading achievement ${index} icon`}
                        />
                        <Skeleton
                            className="h-4 flex-1"
                            accessibilityLabel={`Loading achievement ${index} title`}
                        />
                    </View>
                ))}
            </View>
        </View>
    );
}
