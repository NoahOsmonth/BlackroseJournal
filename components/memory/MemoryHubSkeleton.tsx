import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { LoadingStatus } from '@/components/ui/LoadingStatus';

/** Mirrors portrait, filter row and atom cards in MemoryHubScreen.tsx. */
export function MemoryHubSkeleton() {
    return (
        <View className="gap-6 py-4" accessibilityLabel="Loading memory">
            <LoadingStatus label="Gathering your memories" compact />
            <View className="gap-3">
                <Skeleton className="h-6 w-40" accessibilityLabel="Loading memory portrait title" />
                <Skeleton className="h-4 w-3/4" accessibilityLabel="Loading memory portrait description" />
                <View className="flex-row gap-2">
                    {[1, 2, 3].map((index) => (
                        <Skeleton key={index} className="h-8 w-16 rounded-control" accessibilityLabel={`Loading memory theme ${index}`} />
                    ))}
                </View>
            </View>
            {[1, 2, 3, 4].map((index) => (
                <View
                    key={index}
                    className="gap-3 rounded-card border border-hairline-light bg-surface-light px-4 py-4 dark:border-hairline-dark dark:bg-surface-dark"
                >
                    <Skeleton className="h-5 w-40" accessibilityLabel={`Loading memory title ${index}`} />
                    <Skeleton className="h-3 w-3/4" accessibilityLabel={`Loading memory summary ${index}`} />
                    <Skeleton className="h-3 w-24" accessibilityLabel={`Loading memory layer ${index}`} />
                </View>
            ))}
        </View>
    );
}
