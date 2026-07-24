import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { SkeletonText } from '@/components/ui/SkeletonText';

/** Mirrors the content of the haiku card in app/streak-haiku.tsx. */
export function StreakHaikuSkeleton() {
    return (
        <View className="gap-4" accessibilityLabel="Loading haiku">
            <Skeleton className="h-5 w-28" accessibilityLabel="Loading haiku title" />
            <SkeletonText lines={3} lineClassName="h-5" accessibilityLabel="Loading haiku lines" />
        </View>
    );
}
