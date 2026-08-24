import React from 'react';
import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { LoadingStatus } from '@/components/ui/LoadingStatus';

/** Mirrors the PersonaForm layout used by app/persona/new.tsx. */
export function PersonaFormSkeleton() {
    return (
        <View className="flex-1" accessibilityLabel="Loading persona form">
            {/* Header row */}
            <View className="flex-row items-center justify-between px-4 py-3">
                <Skeleton className="h-6 w-6 rounded-md" accessibilityLabel="Loading back button" />
                <Skeleton className="h-5 w-24" accessibilityLabel="Loading persona form title" />
                <Skeleton className="h-5 w-14" accessibilityLabel="Loading submit button" />
            </View>

            <View className="px-4 pb-10">
                <LoadingStatus label="Loading persona" compact />

                {/* Avatar */}
                <View className="items-center py-8">
                    <Skeleton className="h-28 w-28 rounded-full" accessibilityLabel="Loading persona avatar" />
                </View>

                {/* Name / Tagline / Voice card */}
                <View className="bg-surface-light dark:bg-surface-dark rounded-xl overflow-hidden mb-6">
                    <Skeleton className="h-12 rounded-none" accessibilityLabel="Loading persona name field" />
                    <View className="px-4">
                        <View className="h-px bg-divider-light dark:bg-divider-dark" />
                    </View>
                    <Skeleton className="h-12 rounded-none" accessibilityLabel="Loading persona tagline field" />
                    <View className="px-4">
                        <View className="h-px bg-divider-light dark:bg-divider-dark" />
                    </View>
                    <View className="flex-row items-center justify-between px-4 py-3">
                        <View className="flex-row items-center gap-3">
                            <Skeleton className="h-5 w-5 rounded" accessibilityLabel="Loading voice icon" />
                            <Skeleton className="h-4 w-12" accessibilityLabel="Loading voice label" />
                        </View>
                        <Skeleton className="h-4 w-16" accessibilityLabel="Loading voice value" />
                    </View>
                </View>

                {/* Personalization */}
                <View className="mb-6">
                    <Skeleton className="h-3 w-24 mb-2 ml-4" accessibilityLabel="Loading personalization label" />
                    <View className="bg-surface-light dark:bg-surface-dark rounded-xl p-4 h-48">
                        <Skeleton className="h-4 w-full" accessibilityLabel="Loading persona prompt line 1" />
                        <Skeleton className="h-4 w-3/4 mt-3" accessibilityLabel="Loading persona prompt line 2" />
                        <Skeleton className="h-4 w-1/2 mt-3" accessibilityLabel="Loading persona prompt line 3" />
                    </View>
                </View>

                {/* Advanced */}
                <View className="mb-10">
                    <Skeleton className="h-3 w-12 mb-2 ml-4" accessibilityLabel="Loading more label" />
                    <View className="bg-surface-light dark:bg-surface-dark rounded-xl px-4 py-3">
                        <Skeleton className="h-5 w-20" accessibilityLabel="Loading advanced row" />
                    </View>
                </View>
            </View>
        </View>
    );
}