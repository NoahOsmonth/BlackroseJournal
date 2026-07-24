import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { SkeletonText } from '@/components/ui/SkeletonText';

/** Mirrors the loading content of app/entry-reflection.tsx. */
export function EntryReflectionSkeleton() {
    return (
        <View className="gap-4 py-4" accessibilityLabel="Loading reflection">
            <View className="gap-4 p-5 rounded-2xl bg-surface-light dark:bg-surface-dark shadow-card">
                <SkeletonText lines={4} accessibilityLabel="Loading reflection text" />
                <View className="flex-row items-center justify-between pt-4 border-t border-divider-light dark:border-divider-dark">
                    <Skeleton className="h-3 w-16" accessibilityLabel="Loading feedback label" />
                    <View className="flex-row gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" accessibilityLabel="Loading positive feedback" />
                        <Skeleton className="h-8 w-8 rounded-full" accessibilityLabel="Loading negative feedback" />
                    </View>
                </View>
            </View>
            <View className="gap-3">
                <Skeleton className="h-3 w-24" accessibilityLabel="Loading insight label" />
                <View className="p-5 rounded-2xl bg-surface-light dark:bg-surface-dark">
                    <SkeletonText lines={3} accessibilityLabel="Loading insight" />
                </View>
            </View>
            <View className="flex-row items-center justify-between p-5 rounded-2xl bg-surface-light dark:bg-surface-dark">
                <View className="flex-1 gap-2">
                    <Skeleton className="h-4 w-32" accessibilityLabel="Loading suggestions title" />
                    <Skeleton className="h-3 w-48" accessibilityLabel="Loading suggestions subtitle" />
                </View>
                <Skeleton className="h-6 w-6 rounded-md" accessibilityLabel="Loading suggestions action" />
            </View>
        </View>
    );
}
