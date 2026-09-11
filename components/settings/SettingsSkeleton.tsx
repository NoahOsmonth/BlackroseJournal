import React from 'react';
import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { LoadingStatus } from '@/components/ui/LoadingStatus';

/** Mirrors the accordion sections of app/(tabs)/settings.tsx. */
export function SettingsSkeleton() {
    return (
        <View className="flex-1 gap-6 px-5 pt-6" accessibilityLabel="Loading settings">
            <LoadingStatus label="Loading settings" compact />

            <View className="mb-6">
                <Skeleton className="h-8 w-32" accessibilityLabel="Loading settings title" />
                <Skeleton className="mt-2 h-4 w-48" accessibilityLabel="Loading settings subtitle" />
            </View>

            {/* One hairline card per accordion section — matches the ported shell. */}
            <View className="gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((index) => (
                    <View
                        key={index}
                        className="gap-3 rounded-card border border-hairline-light bg-surface-light p-4 dark:border-hairline-dark dark:bg-surface-dark"
                    >
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center gap-3">
                                <Skeleton className="h-6 w-6 rounded-control" accessibilityLabel={`Loading section ${index} icon`} />
                                <Skeleton className="h-5 w-20" accessibilityLabel={`Loading section ${index} title`} />
                            </View>
                            <Skeleton className="h-6 w-6 rounded-full" accessibilityLabel={`Loading section ${index} chevron`} />
                        </View>

                        <View className="gap-3 pl-9">
                            {[1, 2, 3].map((row) => (
                                <View key={row} className="flex-row items-center justify-between gap-3 p-3">
                                    <View className="flex-row items-center gap-3">
                                        <Skeleton className="h-5 w-5 rounded" accessibilityLabel={`Loading row ${row} icon`} />
                                        <Skeleton className="h-4 w-24" accessibilityLabel={`Loading row ${row} label`} />
                                    </View>
                                    <Skeleton className="h-8 w-20 rounded-control" accessibilityLabel={`Loading row ${row} control`} />
                                </View>
                            ))}
                        </View>
                    </View>
                ))}
            </View>

            <View className="h-6" />
        </View>
    );
}
