/**
 * Rewards Screen
 * Shows streak and achievements with progress
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AchievementProgress, useAchievements } from '@/hooks/useAchievements';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RewardsScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const { achievements, unlockedCount, totalCount, currentStreak, longestStreak } = useAchievements();

    const [selectedAchievement, setSelectedAchievement] = useState<AchievementProgress | null>(null);

    const handleBack = () => {
        router.back();
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full">
                {/* Header */}
                <View className="flex-row items-center justify-between px-6 py-4">
                    <Pressable
                        onPress={handleBack}
                        className="p-2 -ml-2"
                        hitSlop={8}
                        accessibilityLabel="Go back"
                        accessibilityRole="button"
                    >
                        <MaterialIcons
                            name="arrow-back"
                            size={24}
                            color={isDark ? '#E5E5E7' : '#757575'}
                        />
                    </Pressable>

                    <Text className="text-lg font-bold text-text-main-light dark:text-text-main-dark">
                        Rewards
                    </Text>

                    <View className="w-10" />
                </View>

                <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
                    {/* Streak Card */}
                    <View className={`p-6 rounded-2xl mb-6 ${isDark ? 'bg-surface-dark' : 'bg-surface-light'}`}>
                        <View className="flex-row items-center justify-between mb-4">
                            <Text className="text-6xl">🔥</Text>
                            <View className="items-end">
                                <Text className="text-4xl font-bold text-primary">
                                    {currentStreak}
                                </Text>
                                <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                                    Current Streak
                                </Text>
                            </View>
                        </View>
                        <View className="border-t border-divider-light dark:border-divider-dark pt-4">
                            <Text className="text-text-secondary-light dark:text-text-secondary-dark">
                                Longest streak: <Text className="font-bold">{longestStreak} {longestStreak === 1 ? 'day' : 'days'}</Text>
                            </Text>
                        </View>
                    </View>

                    {/* Achievements Header */}
                    <View className="flex-row items-center justify-between mb-4">
                        <Text className="text-lg font-bold text-text-main-light dark:text-text-main-dark">
                            Achievements
                        </Text>
                        <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                            {unlockedCount}/{totalCount} unlocked
                        </Text>
                    </View>

                    {/* Achievements Grid */}
                    <View className="flex-row flex-wrap -mx-2 mb-6">
                        {achievements.map((item) => (
                            <Pressable
                                key={item.achievement.id}
                                onPress={() => setSelectedAchievement(item)}
                                className="w-1/3 p-2"
                            >
                                <View
                                    className={`p-4 rounded-xl items-center ${isDark ? 'bg-surface-dark' : 'bg-surface-light'
                                        } ${!item.isUnlocked ? 'opacity-50' : ''}`}
                                >
                                    <Text className="text-3xl mb-2">
                                        {item.isUnlocked ? item.achievement.icon : '🔒'}
                                    </Text>
                                    <Text
                                        className="text-xs font-bold text-text-main-light dark:text-text-main-dark text-center"
                                        numberOfLines={2}
                                    >
                                        {item.achievement.title}
                                    </Text>
                                    {!item.isUnlocked && (
                                        <View className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full mt-2">
                                            <View
                                                className="h-full bg-primary rounded-full"
                                                style={{ width: `${item.progress * 100}%` }}
                                            />
                                        </View>
                                    )}
                                </View>
                            </Pressable>
                        ))}
                    </View>

                    <View className="h-6" />
                </ScrollView>

                {/* Achievement Detail Modal */}
                <Modal
                    visible={!!selectedAchievement}
                    animationType="fade"
                    transparent
                    onRequestClose={() => setSelectedAchievement(null)}
                >
                    <View
                        className="flex-1 bg-black/50 justify-center items-center p-6"
                        onTouchEnd={() => setSelectedAchievement(null)}
                    >
                        {selectedAchievement && (
                            <View
                                className={`w-full max-w-sm p-6 rounded-2xl ${isDark ? 'bg-surface-dark' : 'bg-surface-light'
                                    }`}
                                onTouchEnd={(e) => e.stopPropagation()}
                            >
                                <Text className="text-5xl text-center mb-4">
                                    {selectedAchievement.isUnlocked
                                        ? selectedAchievement.achievement.icon
                                        : '🔒'}
                                </Text>
                                <Text className="text-xl font-bold text-text-main-light dark:text-text-main-dark text-center mb-2">
                                    {selectedAchievement.achievement.title}
                                </Text>
                                <Text className="text-text-secondary-light dark:text-text-secondary-dark text-center mb-4">
                                    {selectedAchievement.achievement.description}
                                </Text>
                                {!selectedAchievement.isUnlocked && (
                                    <View className="items-center">
                                        <Text className="text-sm text-primary font-bold">
                                            {Math.round(selectedAchievement.progress * 100)}% complete
                                        </Text>
                                    </View>
                                )}
                                {selectedAchievement.isUnlocked && (
                                    <View className="items-center">
                                        <Text className="text-sm text-green-500 font-bold">
                                            ✓ Unlocked!
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                </Modal>
            </View>
        </SafeAreaView>
    );
}
