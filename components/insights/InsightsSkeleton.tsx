import React from 'react';
import { View } from 'react-native';

function Block({ className }: { className: string }) {
    return (
        <View className={`rounded-md bg-divider-light/80 dark:bg-divider-dark/80 ${className}`} />
    );
}

export function InsightsSkeleton() {
    return (
        <View className="gap-4" accessibilityLabel="Loading insights">
            <View className="rounded-2xl border border-divider-light dark:border-divider-dark bg-surface-light dark:bg-surface-dark p-5 gap-3">
                <Block className="h-3 w-24" />
                <Block className="h-4 w-full" />
                <Block className="h-4 w-48" />
                <Block className="h-4 w-36" />
            </View>
            <View className="rounded-2xl border border-divider-light dark:border-divider-dark bg-surface-light dark:bg-surface-dark p-5 gap-3">
                <Block className="h-3 w-32" />
                <Block className="h-16 w-full" />
            </View>
        </View>
    );
}
