/**
 * HappinessRecipeSection Component
 * Section showing completed count with dropdown + add buttons
 * Matches today.html design
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface HappinessRecipeSectionProps {
    completedCount: number;
    onCompletedPress: () => void;
    onAddIngredient: () => void;
    onAddGoal: () => void;
    onEditPress: () => void;
}

export function HappinessRecipeSection({
    completedCount,
    onCompletedPress,
    onAddIngredient,
    onAddGoal,
    onEditPress,
}: HappinessRecipeSectionProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    return (
        <View className="space-y-3">
            {/* Header row */}
            <View className="flex-row justify-between items-center ml-1">
                <Text className="text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">
                    Happiness Recipe
                </Text>
                <Pressable onPress={onEditPress} hitSlop={8}>
                    <Text className="text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark">
                        Edit
                    </Text>
                </Pressable>
            </View>

            {/* Completed dropdown */}
            <Pressable
                onPress={onCompletedPress}
                accessibilityLabel={`Completed: ${completedCount}`}
                accessibilityRole="button"
                className={`bg-surface-light dark:bg-surface-dark rounded-xl p-4 flex-row justify-between items-center ${isDark ? 'border border-border-dark' : ''
                    }`}
                style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isDark ? 0 : 0.03,
                    shadowRadius: 5,
                    elevation: isDark ? 0 : 2,
                }}
            >
                <Text className="font-bold text-text-main-light dark:text-text-main-dark">
                    Completed
                </Text>
                <View className="flex-row items-center">
                    <Text className="font-bold text-text-main-light dark:text-text-main-dark mr-2">
                        {completedCount}
                    </Text>
                    <MaterialIcons
                        name="expand-more"
                        size={20}
                        color={isDark ? '#E0E0E0' : '#333333'}
                    />
                </View>
            </Pressable>

            {/* Add ingredient button */}
            <Pressable
                onPress={onAddIngredient}
                accessibilityLabel="Add ingredient"
                accessibilityRole="button"
                className={`w-full bg-surface-light dark:bg-surface-dark border py-3 px-4 rounded-xl flex-row items-center justify-center ${isDark ? 'border-border-dark' : 'border-gray-200'
                    }`}
            >
                <MaterialIcons
                    name="add"
                    size={18}
                    color={isDark ? '#E0E0E0' : '#333333'}
                    style={{ marginRight: 8 }}
                />
                <Text className="font-bold text-text-main-light dark:text-text-main-dark">
                    Add ingredient
                </Text>
            </Pressable>

            {/* Add goal button */}
            <Pressable
                onPress={onAddGoal}
                accessibilityLabel="Add goal"
                accessibilityRole="button"
                className={`w-full bg-surface-light dark:bg-surface-dark border py-3 px-4 rounded-xl flex-row items-center justify-center ${isDark ? 'border-border-dark' : 'border-gray-200'
                    }`}
            >
                <MaterialIcons
                    name="landscape"
                    size={18}
                    color="#93C5FD"
                    style={{ marginRight: 8 }}
                />
                <Text className="font-bold text-text-main-light dark:text-text-main-dark">
                    Add goal
                </Text>
            </Pressable>
        </View>
    );
}
