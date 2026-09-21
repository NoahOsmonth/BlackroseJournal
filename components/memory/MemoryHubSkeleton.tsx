import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { LoadingStatus } from '@/components/ui/LoadingStatus';

/** Mirrors the composer, portrait and ledger rows in MemoryHubScreen.tsx. */
export function MemoryHubSkeleton() {
    return (
        <View className="gap-6 py-4" accessibilityLabel="Loading memory">
            <LoadingStatus label="Gathering your memories" compact />
            <View className="flex-row gap-4">
                <Skeleton className="h-10 w-11" accessibilityLabel="Loading composer date" />
                <View className="flex-1 gap-3">
                    <Skeleton className="h-4 w-20" accessibilityLabel="Loading composer label" />
                    <Skeleton className="h-20 w-full" accessibilityLabel="Loading composer input" />
                </View>
            </View>
            <View className="gap-5">
                {[1, 2, 3, 4].map((index) => (
                    <View key={index} className="flex-row gap-4">
                        <Skeleton className="h-8 w-11" accessibilityLabel={`Loading memory date ${index}`} />
                        <View className="flex-1 gap-2">
                            <Skeleton className="h-5 w-40" accessibilityLabel={`Loading memory title ${index}`} />
                            <Skeleton className="h-3 w-3/4" accessibilityLabel={`Loading memory summary ${index}`} />
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}
