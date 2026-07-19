import React from 'react';
import { View } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';

function DaySkeleton() {
    return (
        <View className="gap-3">
            <View className="flex-row items-end gap-2.5">
                <Skeleton className="h-8 w-10" />
                <Skeleton className="mb-1 h-3 w-14" />
            </View>
            <View className="overflow-hidden rounded-2xl border border-divider-light dark:border-divider-dark bg-surface-light dark:bg-surface-dark px-4 py-3.5 gap-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-full" />
                <View className="my-1 h-px bg-divider-light dark:bg-divider-dark" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-36" />
            </View>
        </View>
    );
}

export function HistorySkeleton() {
    return (
        <View className="gap-6" accessibilityLabel="Loading history">
            <DaySkeleton />
            <DaySkeleton />
        </View>
    );
}
