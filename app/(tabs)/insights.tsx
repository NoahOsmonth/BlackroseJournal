/**
 * Insights Screen — weekly letter, writing presence, and meaning.
 */

import React from 'react';
import { Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { CastOfCharacters } from '@/components/insights/CastOfCharacters';
import { EmotionalLandscapeChart } from '@/components/insights/EmotionalLandscapeChart';
import { InsightsAskRow } from '@/components/insights/InsightsAskRow';
import { InsightsHeader } from '@/components/insights/InsightsHeader';
import { InsightsSkeleton } from '@/components/insights/InsightsSkeleton';
import { InsightsWeekLetter, INSIGHTS_UNLOCK_AT } from '@/components/insights/InsightsWeekLetter';
import { InsightsWritingPresence } from '@/components/insights/InsightsWritingPresence';
import { KeyThemes } from '@/components/insights/KeyThemes';
import { BottomNav } from '@/components/journal';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { RevealItem } from '@/components/ui/RevealItem';
import { useScrollReveal } from '@/components/ui/useScrollReveal';
import { StaggerEntranceItem } from '@/components/ui/StaggerEntrance';
import { navAwareBottomPadding } from '@/constants/spacing';
import { useThemeSettings } from '@/hooks/useThemeSettings';
import { useWeeklyInsights } from '@/hooks/useWeeklyInsights';
import { useTabNavigation } from '@/hooks/navigation/useTabNavigation';

export default function InsightsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { scrollY, onScroll } = useScrollReveal();
    const { goToTab } = useTabNavigation();
    const { insights, weeklyStats, weekDateRange, isLoading } = useWeeklyInsights();
    const { emojiStyle } = useThemeSettings();

    const isUnlocked = weeklyStats.entriesCount >= INSIGHTS_UNLOCK_AT;
    const activeDays = weeklyStats.dailyWords.filter((count) => count > 0).length;

    const handleTabPress = (tab: 'today' | 'explore' | 'entries' | 'settings' | 'insights') => {
        if (tab !== 'insights') {
            goToTab(tab);
        }
    };

    return (
        <ScreenContainer edges="top">
            <View className="flex-1 px-4 pt-6">
                <InsightsHeader dateRange={weekDateRange} />

                <Animated.ScrollView
                    className="flex-1"
                    contentContainerStyle={{ paddingBottom: navAwareBottomPadding(insets.bottom) }}
                    showsVerticalScrollIndicator={false}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                >
                    <View className="gap-6">
                        <RevealItem scrollY={scrollY}>
                            <StaggerEntranceItem index={0} totalItems={4} staggerType="linear" columns={1}>
                                <InsightsWeekLetter
                                    isUnlocked={isUnlocked}
                                    entriesCount={weeklyStats.entriesCount}
                                    weeklySummary={insights?.weeklySummary}
                                    onWritePress={() => router.push('/chat')}
                                />
                            </StaggerEntranceItem>
                        </RevealItem>

                        <RevealItem scrollY={scrollY}>
                            <StaggerEntranceItem index={1} totalItems={4} staggerType="linear" columns={1}>
                                <InsightsWritingPresence
                                    words={weeklyStats.totalWords}
                                    entries={weeklyStats.entriesCount}
                                    dailyWords={weeklyStats.dailyWords}
                                    maxWords={weeklyStats.maxWords}
                                />
                            </StaggerEntranceItem>
                        </RevealItem>

                        <RevealItem scrollY={scrollY}>
                            {isUnlocked ? (
                                isLoading ? (
                                    <InsightsSkeleton />
                                ) : (
                                    <View className="gap-4">
                                        <View className="rounded-2xl border border-divider-light dark:border-divider-dark bg-surface-light dark:bg-surface-dark px-5 py-5">
                                            <Text className="mb-3 text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                                                Moods
                                            </Text>
                                            <EmotionalLandscapeChart
                                                data={insights?.emotionalLandscape || []}
                                                emojiStyle={emojiStyle}
                                            />
                                        </View>
                                        <KeyThemes themes={insights?.keyThemes || []} />
                                        <CastOfCharacters characters={insights?.castOfCharacters || []} />
                                    </View>
                                )
                            ) : (
                                <Text className="px-1 text-sm leading-relaxed text-text-secondary-light dark:text-text-secondary-dark">
                                    Moods, themes, and people unlock with this week&apos;s letter
                                    {activeDays > 0 ? ` · ${activeDays} active ${activeDays === 1 ? 'day' : 'days'} so far` : ''}.
                                </Text>
                            )}
                        </RevealItem>

                        <RevealItem scrollY={scrollY}>
                            <InsightsAskRow onPress={() => router.push('/ask-rosebud')} />
                        </RevealItem>
                    </View>
                </Animated.ScrollView>
            </View>

            <BottomNav
                activeTab="insights"
                onTabPress={handleTabPress}
                onFabPress={() => router.push('/chat')}
            />
        </ScreenContainer>
    );
}
