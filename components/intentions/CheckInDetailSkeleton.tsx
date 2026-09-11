import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { SkeletonText } from '@/components/ui/SkeletonText';

/** Mirrors the summary card and transcript in app/checkin-detail.tsx. */
export function CheckInDetailSkeleton() {
    return (
        <View className="flex-1 gap-8 px-5 pt-4" accessibilityLabel="Loading check-in">
            <View className="gap-4 rounded-card border border-hairline-light bg-surface-light p-5 dark:border-hairline-dark dark:bg-surface-dark">
                <View className="flex-row justify-between">
                    <Skeleton className="h-3 w-28" accessibilityLabel="Loading check-in type" />
                    <Skeleton className="h-3 w-12" accessibilityLabel="Loading check-in time" />
                </View>
                <Skeleton className="h-6 w-3/4" accessibilityLabel="Loading check-in title" />
                <SkeletonText lines={2} accessibilityLabel="Loading check-in summary" />
                <Skeleton className="h-4 w-20" accessibilityLabel="Loading check-in mood" />
            </View>
            <View className="gap-3">
                <Skeleton className="h-4 w-20" accessibilityLabel="Loading transcript label" />
                <Skeleton className="h-16 w-3/4 rounded-card" accessibilityLabel="Loading check-in message one" />
                <Skeleton className="self-end h-16 w-3/4 rounded-card" accessibilityLabel="Loading check-in message two" />
            </View>
        </View>
    );
}
