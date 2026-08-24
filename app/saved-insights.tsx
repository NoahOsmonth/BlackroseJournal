import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNavBack } from '@/hooks/navigation/useNavBack';
import { useSavedInsights } from '@/hooks/saved-insights/useSavedInsights';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingStatus } from '@/components/ui/LoadingStatus';
import { RevealItem } from '@/components/ui/RevealItem';
import { useScrollReveal } from '@/components/ui/useScrollReveal';
import { StaggerEntranceItem } from '@/components/ui/StaggerEntrance';
import { AnimatedRemove } from '@/components/ui/AnimatedRemove';

export default function SavedInsightsScreen() {
    const goBack = useNavBack('/(tabs)/insights');
    const { scrollY, onScroll } = useScrollReveal();
    const { insights, isLoading, remove } = useSavedInsights();
    const colorScheme = useColorScheme();
    const iconColor = colorScheme === 'dark' ? '#F9FAFB' : '#111827';
    const [removingId, setRemovingId] = useState<string | null>(null);
    const [removedCount, setRemovedCount] = useState<Record<string, boolean>>({});

    const handleRemove = useCallback((id: string) => {
        setRemovingId(id);
    }, []);

    const handleExited = useCallback((id: string) => {
        setRemovedCount((prev) => ({ ...prev, [id]: true }));
        setRemovingId(null);
    }, []);

    const visibleInsights = insights.filter((insight) => !removedCount[insight.id]);

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

                {isLoading ? (
                    <View className="flex-1 max-w-md mx-auto w-full items-center justify-center px-6">
                        <LoadingStatus label="Loading saved insights" detail="Gathering your saved reflections." />
                    </View>
                ) : visibleInsights.length === 0 ? (
                    <View className="flex-1 px-6 items-center justify-center">
                        <EmptyState
                            icon="bookmark-border"
                            title="No saved insights yet"
                            message="When you save an insight from a conversation, it will show up here so you can revisit it anytime."
                        />
                    </View>
                ) : (
                    <Animated.ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
                        <View className="gap-4 pb-8">
                            {visibleInsights.map((insight, index) => (
                                <RevealItem key={insight.id} scrollY={scrollY}>
                                    <StaggerEntranceItem
                                        index={index}
                                        columns={1}
                                        totalItems={visibleInsights.length}
                                        staggerType="linear"
                                        baseDelayMs={20}
                                        delayFactorMs={40}
                                        className="w-full"
                                    >
                                        <AnimatedRemove
                                            removing={removingId === insight.id}
                                            onExited={() => {
                                                handleExited(insight.id);
                                                remove(insight.id);
                                            }}
                                        >
                                            <View className="bg-surface-light dark:bg-surface-dark rounded-2xl p-5 shadow-soft border border-gray-100 dark:border-divider-dark">
                                                <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-2">
                                                    {insight.sourceDate ?? 'Saved'}
                                                </Text>
                                                <Text className="text-base font-medium text-text-light dark:text-text-dark">
                                                    {insight.question}
                                                </Text>
                                                <Pressable
                                                    onPress={() => handleRemove(insight.id)}
                                                    className="flex-row items-center gap-2 mt-4"
                                                >
                                                    <MaterialIcons name="delete" size={18} color="#9CA3AF" />
                                                    <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                                                        Remove
                                                    </Text>
                                                </Pressable>
                                            </View>
                                        </AnimatedRemove>
                                    </StaggerEntranceItem>
                                </RevealItem>
                            ))}
                        </View>
                    </Animated.ScrollView>
                )}
            </View>
        </SafeAreaView>
    );
}
