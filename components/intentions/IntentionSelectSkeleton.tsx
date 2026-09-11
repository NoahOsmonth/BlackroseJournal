import React from 'react';
import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { LoadingStatus } from '@/components/ui/LoadingStatus';

/** Mirrors the hairline area list inside the intention picker sheet. */
export function IntentionSelectSkeleton() {
    return (
        <View accessibilityLabel="Loading intention areas">
            <LoadingStatus label="Loading intention areas" compact />
            {[1, 2, 3, 4, 5].map((index) => (
                <View
                    key={index}
                    className="min-h-[64px] flex-row items-center justify-between border-t border-hairline-light pl-4 pr-5 dark:border-hairline-dark"
                    accessibilityLabel={`Loading intention area ${index}`}
                >
                    <View className="flex-1 flex-row items-center gap-3">
                        <View className="h-[26px] w-[3px]" />
                        <Skeleton className="h-4 w-2/5" accessibilityLabel={`Loading intention area ${index} title`} />
                    </View>
                    <Skeleton className="h-5 w-5 rounded-full" accessibilityLabel={`Loading intention area ${index} chevron`} />
                </View>
            ))}
        </View>
    );
}
