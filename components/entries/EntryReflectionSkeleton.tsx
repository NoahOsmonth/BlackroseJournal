import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { SkeletonText } from '@/components/ui/SkeletonText';
import { LoadingStatus } from '@/components/ui/LoadingStatus';

/** Mirrors the loading content of app/entry-reflection.tsx. */
export function EntryReflectionSkeleton() {
    return (
        <View className="gap-6 pt-8" accessibilityLabel="Loading reflection">
            <LoadingStatus label="Reflecting on your entry" compact />

            <View className="gap-5 rounded-card border border-hairline-light bg-surface-light p-5 dark:border-hairline-dark dark:bg-surface-dark">
                <View className="flex-row items-center gap-3">
                    <Skeleton className="h-6 w-6 rounded-full" accessibilityLabel="Loading reflection mark" />
                    <Skeleton className="h-5 w-28" accessibilityLabel="Loading reflection title" />
                </View>
                <SkeletonText lines={3} accessibilityLabel="Loading reflection text" />
            </View>

            <View className="min-h-[64px] flex-row overflow-hidden rounded-card border border-hairline-light dark:border-hairline-dark">
                <View className="flex-1 items-center justify-center">
                    <Skeleton className="h-5 w-24" accessibilityLabel="Loading positive feedback" />
                </View>
                <View className="w-px bg-hairline-light dark:bg-hairline-dark" />
                <View className="flex-1 items-center justify-center">
                    <Skeleton className="h-5 w-24" accessibilityLabel="Loading negative feedback" />
                </View>
            </View>

            <View className="gap-3">
                <Skeleton className="h-3 w-24" accessibilityLabel="Loading insight label" />
                <View className="rounded-card border border-hairline-light bg-surface-light p-5 dark:border-hairline-dark dark:bg-surface-dark">
                    <SkeletonText lines={2} accessibilityLabel="Loading insight" />
                </View>
            </View>
        </View>
    );
}
