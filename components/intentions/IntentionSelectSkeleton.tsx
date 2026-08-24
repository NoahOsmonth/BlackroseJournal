import React from 'react';
import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { LoadingStatus } from '@/components/ui/LoadingStatus';

/** Mirrors the intention area list of app/intentions/select.tsx. */
export function IntentionSelectSkeleton() {
    return (
        <View className="gap-3 pb-6" accessibilityLabel="Loading intention areas">
            <LoadingStatus label="Loading intention areas" compact />
            <View className="h-2" accessibilityLabel="Loading intention area spacing" />
            {[1, 2, 3, 4, 5].map((index) => (
                <View
                    key={index}
                    className="gap-3 p-4 rounded-2xl bg-surface-light dark:bg-surface-dark"
                    accessibilityLabel={`Loading intention area ${index}`}
                >
                    <View className="flex-row items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" accessibilityLabel={`Loading intention area ${index} icon`} />
                        <View className="flex-1 gap-1.5">
                            <Skeleton className="h-4 w-3/5" accessibilityLabel={`Loading intention area ${index} title`} />
                            <Skeleton className="h-3 w-4/5" accessibilityLabel={`Loading intention area ${index} description`} />
                        </View>
                        <Skeleton className="h-6 w-6 rounded-full" accessibilityLabel={`Loading intention area ${index} chevron`} />
                    </View>
                </View>
            ))}
        </View>
    );
}