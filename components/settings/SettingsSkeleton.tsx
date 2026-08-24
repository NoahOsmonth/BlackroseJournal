import React from 'react';
import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { SkeletonText } from '@/components/ui/SkeletonText';
import { LoadingStatus } from '@/components/ui/LoadingStatus';

/** Mirrors the accordion sections of app/(tabs)/settings.tsx. */
export function SettingsSkeleton() {
    return (
        <View className="flex-1 gap-6 px-4 pt-6" accessibilityLabel="Loading settings">
            <LoadingStatus label="Loading settings" compact />

            {/* Header */}
            <View className="mb-6">
                <Skeleton className="h-8 w-32" accessibilityLabel="Loading settings title" />
                <Skeleton className="h-4 w-48 mt-2" accessibilityLabel="Loading settings subtitle" />
            </View>

            {/* Accordion sections - 8 sections */}
            <View className="gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((index) => (
                    <View key={index} className="gap-3 p-4 rounded-2xl bg-surface-light dark:bg-surface-dark">
                        {/* Section header */}
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center gap-3">
                                <Skeleton className="h-6 w-6 rounded-lg" accessibilityLabel={`Loading section ${index} icon`} />
                                <Skeleton className="h-5 w-20" accessibilityLabel={`Loading section ${index} title`} />
                            </View>
                            <Skeleton className="h-6 w-6 rounded-full" accessibilityLabel={`Loading section ${index} chevron`} />
                        </View>

                        {/* Section content skeleton */}
                        <View className="gap-3 pl-9">
                            {[1, 2, 3].map((row) => (
                                <View key={row} className="flex-row items-center justify-between p-3 rounded-xl bg-background-light dark:bg-background-dark">
                                    <View className="flex-row items-center gap-3">
                                        <Skeleton className="h-5 w-5 rounded" accessibilityLabel={`Loading row ${row} icon`} />
                                        <Skeleton className="h-4 w-24" accessibilityLabel={`Loading row ${row} label`} />
                                    </View>
                                    <Skeleton className="h-8 w-20 rounded-lg" accessibilityLabel={`Loading row ${row} control`} />
                                </View>
                            ))}
                        </View>
                    </View>
                ))}
            </View>

            {/* Bottom spacing */}
            <View className="h-6" />
        </View>
    );
}