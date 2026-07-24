import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';

/** Mirrors portrait and atom rows in MemoryHubScreen.tsx. */
export function MemoryHubSkeleton() {
    return (
        <View className="gap-6 py-4" accessibilityLabel="Loading memory">
            <View className="gap-4 p-5 rounded-2xl bg-surface-light dark:bg-surface-dark">
                <Skeleton className="h-6 w-40" accessibilityLabel="Loading memory portrait title" />
                <Skeleton className="h-4 w-3/4" accessibilityLabel="Loading memory portrait description" />
                <View className="flex-row gap-2">
                    {[1, 2, 3].map((index) => (
                        <Skeleton key={index} className="h-7 w-16 rounded-full" accessibilityLabel={`Loading memory theme ${index}`} />
                    ))}
                </View>
            </View>
            <View className="overflow-hidden rounded-2xl border border-divider-light dark:border-divider-dark bg-surface-light dark:bg-surface-dark">
                {[1, 2, 3, 4].map((index) => (
                    <View key={index} className="flex-row items-center gap-3 p-4 border-b border-divider-light dark:border-divider-dark">
                        <Skeleton className="h-2.5 w-2.5 rounded-full" accessibilityLabel={`Loading memory dot ${index}`} />
                        <View className="flex-1 gap-2">
                            <Skeleton className="h-4 w-32" accessibilityLabel={`Loading memory title ${index}`} />
                            <Skeleton className="h-3 w-16" accessibilityLabel={`Loading memory layer ${index}`} />
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}
