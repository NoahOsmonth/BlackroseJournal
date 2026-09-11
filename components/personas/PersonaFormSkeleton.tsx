import React from 'react';
import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { LoadingStatus } from '@/components/ui/LoadingStatus';

/** Mirrors the PersonaForm layout used by app/persona/new.tsx. */
export function PersonaFormSkeleton() {
    return (
        <View className="flex-1" accessibilityLabel="Loading persona form">
            {/* Header row */}
            <View className="min-h-[56px] flex-row items-center justify-between px-4 py-2">
                <Skeleton className="h-6 w-6 rounded-md" accessibilityLabel="Loading back button" />
                <Skeleton className="h-6 w-28" accessibilityLabel="Loading persona form title" />
                <Skeleton className="h-5 w-14" accessibilityLabel="Loading submit button" />
            </View>

            <View className="px-4 pb-10">
                <LoadingStatus label="Loading persona" compact />

                {/* Avatar */}
                <View className="items-center py-6">
                    <Skeleton className="h-28 w-28 rounded-full" accessibilityLabel="Loading persona avatar" />
                </View>

                {/* Name / Tagline / Voice rows */}
                <Skeleton className="h-14" accessibilityLabel="Loading persona name field" />
                <View className="h-px bg-hairline-light dark:bg-hairline-dark" />
                <Skeleton className="h-14" accessibilityLabel="Loading persona tagline field" />
                <View className="h-px bg-hairline-light dark:bg-hairline-dark" />
                <View className="min-h-14 flex-row items-center justify-between px-1 py-3">
                    <Skeleton className="h-5 w-14" accessibilityLabel="Loading voice label" />
                    <Skeleton className="h-5 w-16" accessibilityLabel="Loading voice value" />
                </View>

                {/* Personalization */}
                <View className="mt-6">
                    <Skeleton className="mb-2 h-5 w-32" accessibilityLabel="Loading personalization label" />
                    <View className="h-48 rounded-card border border-hairline-light p-4 dark:border-hairline-dark">
                        <Skeleton className="h-4 w-full" accessibilityLabel="Loading persona prompt line 1" />
                        <Skeleton className="mt-3 h-4 w-3/4" accessibilityLabel="Loading persona prompt line 2" />
                        <Skeleton className="mt-3 h-4 w-1/2" accessibilityLabel="Loading persona prompt line 3" />
                    </View>
                </View>

                {/* Advanced */}
                <View className="mb-10 mt-6">
                    <View className="min-h-14 flex-row items-center justify-between border-t border-hairline-light px-1 py-3 dark:border-hairline-dark">
                        <Skeleton className="h-5 w-24" accessibilityLabel="Loading advanced row" />
                        <Skeleton className="h-5 w-5 rounded-full" accessibilityLabel="Loading advanced chevron" />
                    </View>
                </View>
            </View>
        </View>
    );
}