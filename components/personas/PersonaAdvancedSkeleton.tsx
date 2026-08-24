import React from 'react';
import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { SkeletonText } from '@/components/ui/SkeletonText';
import { LoadingStatus } from '@/components/ui/LoadingStatus';

/** Mirrors the advanced settings (Intelligence + Imagination) layout of app/persona/advanced.tsx. */
export function PersonaAdvancedSkeleton() {
    return (
        <View className="flex-1 max-w-md mx-auto px-4 py-6" accessibilityLabel="Loading advanced settings">
            <LoadingStatus label="Loading advanced settings" compact />

            <View className="mb-2 pl-4">
                <Skeleton className="h-3 w-20" accessibilityLabel="Loading intelligence section label" />
            </View>
            <View className="bg-surface-light dark:bg-surface-dark rounded-xl overflow-hidden">
                <View className="flex-row items-center justify-between p-4">
                    <View className="flex-row items-center gap-3">
                        <Skeleton className="h-6 w-6 rounded-lg" accessibilityLabel="Loading AI model icon" />
                        <Skeleton className="h-5 w-20" accessibilityLabel="Loading AI model label" />
                    </View>
                    <Skeleton className="h-5 w-24" accessibilityLabel="Loading AI model value" />
                </View>
                <View className="pl-16">
                    <View className="h-px bg-divider-light dark:bg-divider-dark" />
                </View>
                <View className="p-4">
                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-row items-center gap-3">
                            <Skeleton className="h-6 w-6 rounded-lg" accessibilityLabel="Loading imagination icon" />
                            <Skeleton className="h-5 w-24" accessibilityLabel="Loading imagination label" />
                        </View>
                        <Skeleton className="h-5 w-16" accessibilityLabel="Loading imagination value" />
                    </View>
                    <View className="pl-[52px]">
                        <Skeleton className="h-8 w-full rounded-full" accessibilityLabel="Loading imagination slider" />
                    </View>
                </View>
            </View>
            <View className="mt-3 px-4">
                <SkeletonText lines={2} accessibilityLabel="Loading imagination hint" />
            </View>
        </View>
    );
}