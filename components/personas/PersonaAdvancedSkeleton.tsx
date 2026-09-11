import React from 'react';
import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { SkeletonText } from '@/components/ui/SkeletonText';
import { LoadingStatus } from '@/components/ui/LoadingStatus';

/** Mirrors the model + imagination rows of app/persona/advanced.tsx. */
export function PersonaAdvancedSkeleton() {
    return (
        <View className="flex-1" accessibilityLabel="Loading advanced settings">
            <LoadingStatus label="Loading advanced settings" compact />

            <View className="min-h-14 flex-row items-center justify-between border-t border-hairline-light px-1 py-3 dark:border-hairline-dark">
                <Skeleton className="h-5 w-24" accessibilityLabel="Loading AI model label" />
                <Skeleton className="h-5 w-24" accessibilityLabel="Loading AI model value" />
            </View>

            <View className="border-t border-hairline-light px-1 pt-4 dark:border-hairline-dark">
                <View className="mb-4 flex-row items-center justify-between">
                    <Skeleton className="h-5 w-28" accessibilityLabel="Loading imagination label" />
                    <Skeleton className="h-5 w-20" accessibilityLabel="Loading imagination value" />
                </View>
                <Skeleton className="h-8 w-full rounded-full" accessibilityLabel="Loading imagination slider" />
                <View className="mt-4">
                    <SkeletonText lines={2} accessibilityLabel="Loading imagination hint" />
                </View>
            </View>
        </View>
    );
}
