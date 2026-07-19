import React from 'react';
import { View } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';

export function InsightsSkeleton() {
    return (
        <View className="gap-4" accessibilityLabel="Loading insights">
            <View className="rounded-2xl border border-divider-light dark:border-divider-dark bg-surface-light dark:bg-surface-dark p-5 gap-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-36" />
            </View>
            <View className="rounded-2xl border border-divider-light dark:border-divider-dark bg-surface-light dark:bg-surface-dark p-5 gap-3">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-16 w-full" />
            </View>
        </View>
    );
}
