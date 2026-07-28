import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { SkeletonText } from '@/components/ui/SkeletonText';
import { LoadingStatus } from '@/components/ui/LoadingStatus';

/** Mirrors suggestion cards in app/suggestions.tsx. */
export function SuggestionsSkeleton() {
    return (
        <View className="gap-3 py-4" accessibilityLabel="Loading suggestions">
            <LoadingStatus label="Shaping your next steps" compact />
            {[1, 2, 3].map((index) => (
                <View key={index} className="gap-3 p-5 rounded-2xl bg-surface-light dark:bg-surface-dark">
                    <View className="flex-row items-center justify-between">
                        <Skeleton className="h-5 w-14 rounded-lg" accessibilityLabel={`Loading suggestion type ${index}`} />
                        <Skeleton className="h-9 w-24 rounded-xl" accessibilityLabel={`Loading suggestion action ${index}`} />
                    </View>
                    <SkeletonText lines={2} accessibilityLabel={`Loading suggestion ${index}`} />
                </View>
            ))}
        </View>
    );
}
