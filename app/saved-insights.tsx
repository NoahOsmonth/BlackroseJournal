import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FinishBackgroundBanner } from '@/components/entries/FinishBackgroundBanner';
import { AnimatedRemove } from '@/components/ui/AnimatedRemove';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingStatus } from '@/components/ui/LoadingStatus';
import { RevealItem } from '@/components/ui/RevealItem';
import { StaggerEntranceItem } from '@/components/ui/StaggerEntrance';
import { useScrollReveal } from '@/components/ui/useScrollReveal';
import { useFinishBackgroundStatus } from '@/hooks/journal/useFinishBackgroundStatus';
import { useNavBack } from '@/hooks/navigation/useNavBack';
import { useSavedInsights } from '@/hooks/saved-insights/useSavedInsights';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SavedInsightsScreen() {
    const goBack = useNavBack('/(tabs)/insights');
    const { scrollY, onScroll } = useScrollReveal();
    const { insights, isLoading, remove, refresh } = useSavedInsights();
    const { isDone } = useFinishBackgroundStatus();
    const colorScheme = useColorScheme();
    const iconColor = colorScheme === 'dark' ? '#F9FAFB' : '#111827';
    const [removingId, setRemovingId] = useState<string | null>(null);
    const [removedCount, setRemovedCount] = useState<Record<string, boolean>>({});

    // Saved insights are not memory-change subscribers; refresh when the
    // finish background run settles so new insights appear automatically.
    useEffect(() => {
        if (isDone) {
            void refresh();
        }
    }, [isDone, refresh]);

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
                    <Pressable
                        onPress={goBack}
                        className="-ml-2 min-h-11 min-w-11 items-center justify-center"
                        accessibilityLabel="Back"
                    >
                        <MaterialIcons name="arrow-back" size={26} color={iconColor} />
                    </Pressable>
                    <Text
                        className="text-[26px] leading-[34px] text-text-light dark:text-text-dark"
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                    >
                        Saved insights
                    </Text>
                    <View className="w-10" />
                </View>

                <FinishBackgroundBanner />

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
                    <Animated.ScrollView
                        className="flex-1"
                        contentContainerStyle={{ paddingHorizontal: 16 }}
                        showsVerticalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}>
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
                                            <View className="rounded-card border border-hairline-light bg-surface-light p-5 dark:border-hairline-dark dark:bg-surface-dark">
                                                <Text className="text-[13px] uppercase tracking-[1.4px] text-text-secondary-light dark:text-text-secondary-dark">
                                                    {insight.sourceDate ?? 'Saved'}
                                                </Text>
                                                <Text
                                                    className="mt-3 text-[20px] leading-[29px] text-text-light dark:text-text-dark"
                                                    style={{ fontFamily: 'PlayfairDisplayRegular' }}
                                                >
                                                    {insight.question}
                                                </Text>
                                                <Pressable
                                                    onPress={() => handleRemove(insight.id)}
                                                    className="mt-4 min-h-11 flex-row items-center gap-2 self-start"
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`Remove saved insight: ${insight.question}`}
                                                >
                                                    <MaterialIcons name="delete-outline" size={18} color="#9CA3AF" />
                                                    <Text className="text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
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
