import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNavBack } from '@/hooks/navigation/useNavBack';
import { useSavedInsights } from '@/hooks/saved-insights/useSavedInsights';

export default function SavedInsightsScreen() {
    const goBack = useNavBack('/(tabs)/insights');
    const { insights, remove } = useSavedInsights();
    const colorScheme = useColorScheme();
    const iconColor = colorScheme === 'dark' ? '#F9FAFB' : '#111827';

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full">
                <View className="flex-row items-center justify-between px-4 py-4">
                    <Pressable onPress={goBack} className="p-2 -ml-2">
                        <MaterialIcons name="arrow-back" size={24} color={iconColor} />
                    </Pressable>
                    <Text className="text-lg font-semibold text-text-light dark:text-text-dark">Saved insights</Text>
                    <View className="w-10" />
                </View>

                <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
                    <View className="gap-4 pb-8">
                        {insights.map((insight) => (
                            <View
                                key={insight.id}
                                className="bg-surface-light dark:bg-surface-dark rounded-2xl p-5 shadow-soft border border-gray-100 dark:border-divider-dark"
                            >
                                <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-2">
                                    {insight.sourceDate ?? 'Saved'}
                                </Text>
                                <Text className="text-base font-medium text-text-light dark:text-text-dark">
                                    {insight.question}
                                </Text>
                                <Pressable
                                    onPress={() => remove(insight.id)}
                                    className="flex-row items-center gap-2 mt-4"
                                >
                                    <MaterialIcons name="delete" size={18} color="#9CA3AF" />
                                    <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                                        Remove
                                    </Text>
                                </Pressable>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}
