import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { SkeletonText } from '@/components/ui/SkeletonText';

/** Mirrors the analysis and transcript content of app/entry-detail.tsx. */
export function EntryDetailSkeleton() {
    return (
        <View className="flex-1 gap-5 px-6 pt-4" accessibilityLabel="Loading entry">
            <View className="gap-4 p-5 rounded-2xl bg-surface-light dark:bg-surface-dark">
                <Skeleton className="h-3 w-16" accessibilityLabel="Loading analysis label" />
                <SkeletonText lines={2} accessibilityLabel="Loading insight" />
                <Skeleton className="h-3 w-12" accessibilityLabel="Loading quote label" />
                <SkeletonText lines={2} accessibilityLabel="Loading quote" />
                <View className="flex-row gap-2">
                    <Skeleton className="h-6 w-20 rounded-full" accessibilityLabel="Loading mood" />
                    {[1, 2, 3].map((index) => (
                        <Skeleton key={index} className="h-6 w-16 rounded-full" accessibilityLabel={`Loading topic ${index}`} />
                    ))}
                </View>
            </View>
            <View className="gap-3">
                <Skeleton className="h-16 w-3/4 rounded-2xl" accessibilityLabel="Loading message one" />
                <Skeleton className="self-end h-16 w-3/4 rounded-2xl" accessibilityLabel="Loading message two" />
                <Skeleton className="h-16 w-3/4 rounded-2xl" accessibilityLabel="Loading message three" />
            </View>
        </View>
    );
}
