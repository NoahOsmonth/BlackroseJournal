import React from 'react';
import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { LoadingStatus } from '@/components/ui/LoadingStatus';

/** Mirrors the add-buttons and Ingredients/Habits/Goals sections of app/happiness-recipe.tsx. */
export function HappinessRecipeSkeleton() {
    return (
        <View className="gap-3" accessibilityLabel="Loading happiness recipe">
            <LoadingStatus label="Loading your recipe" compact />

            {/* Add actions */}
            <View className="flex-row gap-3 mb-3">
                <Skeleton className="flex-1 h-12 rounded-xl" accessibilityLabel="Loading add ingredient button" />
                <Skeleton className="flex-1 h-12 rounded-xl" accessibilityLabel="Loading add goal button" />
            </View>

            {/* Ingredient / Habit / Goal sections */}
            {['Ingredients', 'Habits', 'Goals'].map((section) => (
                <View key={section} className="mb-6">
                    <Skeleton
                        className="h-3 w-24 mb-3 ml-1"
                        accessibilityLabel={`Loading ${section} section title`}
                    />
                    <View className="gap-2">
                        {[1, 2, 3].map((row) => (
                            <View
                                key={row}
                                className="flex-row items-center gap-3 p-4 rounded-xl bg-surface-light dark:bg-surface-dark"
                                accessibilityLabel={`Loading ${section} item ${row}`}
                            >
                                <Skeleton className="h-6 w-6 rounded-full" accessibilityLabel={`Loading ${section} item ${row} checkbox`} />
                                <Skeleton className="flex-1 h-4" accessibilityLabel={`Loading ${section} item ${row} text`} />
                            </View>
                        ))}
                    </View>
                </View>
            ))}
        </View>
    );
}