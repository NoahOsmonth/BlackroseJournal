/**
 * Insights Screen
 * Weekly analysis of journal entries
 */

import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { CastOfCharacters } from '@/components/insights/CastOfCharacters';
import { EmotionalLandscapeChart } from '@/components/insights/EmotionalLandscapeChart';
import { KeyThemes } from '@/components/insights/KeyThemes';
import { BottomNav } from '@/components/journal';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { navAwareBottomPadding } from '@/constants/spacing';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeSettings } from '@/hooks/useThemeSettings';
import { useWeeklyInsights } from '@/hooks/useWeeklyInsights';
import { SpatialView } from '@/components/ui/SpatialView';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAILY_WORDS_HEIGHT = 112;
const DAILY_WORDS_CONTAINER_HEIGHT = DAILY_WORDS_HEIGHT + 16;
const DAILY_WORDS_MIN_BAR = 6;

const getDailyBarHeight = (count: number, maxWords: number) => {
    const ratio = maxWords > 0 ? count / maxWords : 0;
    const scaled = Math.round(ratio * DAILY_WORDS_HEIGHT);
    return Math.max(scaled, DAILY_WORDS_MIN_BAR);
};

interface HeaderProps {
    dateRange: string;
}

const Header = ({ dateRange }: HeaderProps) => (
    <View className="mb-6 pb-4 border-b border-divider-light/30 dark:border-divider-dark/30 flex-row items-center justify-between">
        <View>
            <Text className="text-2xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark">
                Insights
            </Text>
            <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark tracking-wide mt-0.5">
                {dateRange}
            </Text>
        </View>
        <View className="flex-row items-center gap-2">
            <Text className="text-[10px] font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-widest bg-divider-light/25 dark:bg-divider-dark/45 px-2.5 py-1 rounded-full">
                This Week
            </Text>
        </View>
    </View>
);

interface WeeklyReportCardProps {
    isLocked: boolean;
    entriesNeeded: number;
    entriesCount: number;
    iconColor: string;
    weeklySummary?: string;
}

const WeeklyReportCard = ({
    isLocked,
    entriesNeeded,
    entriesCount,
    iconColor,
    weeklySummary,
}: WeeklyReportCardProps) => {
    // Render the executive summary quote when unlocked
    if (!isLocked && weeklySummary && weeklySummary !== 'No entries yet this week.') {
        return (
            <View className="mb-8">
                <View className="items-center justify-center mb-3">
                    <Text className="text-[10px] font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-widest">
                        Weekly Analysis
                    </Text>
                </View>
                <View className="bg-surface-light dark:bg-surface-dark/40 border border-divider-light dark:border-divider-dark rounded-2xl p-6 shadow-sm">
                    <View className="flex-row items-center gap-2 mb-4">
                        <MaterialIcons name="auto-awesome" size={18} color="#FF9F0A" />
                        <Text className="text-xs font-bold text-text-primary-light dark:text-text-primary-dark uppercase tracking-wider">
                            AI Executive Summary
                        </Text>
                    </View>
                    <View className="border-l-2 border-primary pl-4 py-1">
                        <Text className="text-sm leading-relaxed text-text-primary-light dark:text-text-primary-dark font-medium italic">
                            &quot;{weeklySummary}&quot;
                        </Text>
                    </View>
                </View>
            </View>
        );
    }

    // Otherwise render progress lock screen
    return (
        <View className="mb-8">
            <View className="items-center justify-center mb-3">
                <Text className="text-[10px] font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-widest">
                    Weekly Analysis
                </Text>
            </View>
            <View className="bg-surface-light dark:bg-surface-dark/40 border border-divider-light dark:border-divider-dark rounded-2xl p-6 items-center justify-center shadow-sm min-h-[180px]">
                <View className="flex-row items-center gap-2 mb-4">
                    <MaterialIcons name="lock-outline" size={18} color={iconColor} />
                    <Text className="text-xs font-bold text-text-primary-light dark:text-text-primary-dark uppercase tracking-wider">
                        Unlocks Saturday
                    </Text>
                </View>

                <Text className="text-xs leading-relaxed text-text-secondary-light dark:text-text-secondary-dark mb-6 text-center max-w-[260px] font-medium">
                    Write daily to unlock your weekly executive AI analysis of emotional landscapes, key themes, and character personas.
                </Text>

                {/* Progress dot indicator track */}
                <View className="flex-row gap-3 items-center">
                    {[0, 1, 2, 3, 4].map((i) => {
                        const isCompleted = i < entriesCount;
                        return (
                            <View
                                key={i}
                                className={`w-2.5 h-2.5 rounded-full ${isCompleted
                                        ? 'bg-primary'
                                        : 'border border-divider-light dark:border-divider-dark bg-transparent'
                                    }`}
                            />
                        );
                    })}
                </View>
                <Text className="text-[10px] font-bold text-text-secondary-light dark:text-text-secondary-dark mt-4 uppercase tracking-widest">
                    {entriesCount} / 5 Entries completed (Requires {entriesNeeded} more)
                </Text>
            </View>
        </View>
    );
};

interface WritingStatsCardProps {
    words: number;
    entries: number;
    dailyWords: number[];
}

interface AskRosebudCardProps {
    onPress: () => void;
    iconColor: string;
}

const AskRosebudCard = ({ onPress, iconColor }: AskRosebudCardProps) => (
    <Pressable
        onPress={onPress}
        className="mb-8 rounded-2xl border border-divider-light bg-surface-light p-5 shadow-sm dark:border-divider-dark dark:bg-surface-dark/40"
        accessibilityRole="button"
        accessibilityLabel="Ask about your journal"
    >
        <View className="flex-row items-center gap-3">
            <View className="rounded-full bg-primary/10 p-3 dark:bg-primary-dark/20">
                <MaterialIcons name="question-answer" size={22} color={iconColor} />
            </View>
            <View className="flex-1">
                <Text className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
                    Ask about your journal
                </Text>
                <Text className="mt-1 text-xs leading-5 text-text-secondary-light dark:text-text-secondary-dark">
                    Ask Rosebud to find patterns across entries, moods, themes, and people.
                </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={iconColor} />
        </View>
    </Pressable>
);

const WritingStatsCard = ({
    words,
    entries,
    dailyWords,
}: WritingStatsCardProps) => {
    const maxWords = Math.max(...dailyWords, 1);
    const todayIndex = new Date().getDay();

    return (
        <View className="mb-8">
            <View className="items-center justify-center mb-3">
                <Text className="text-[10px] font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-widest">
                    Writing Metrics
                </Text>
            </View>

            {/* Avionics-style dual stat monitor */}
            <View className="flex-row border border-divider-light dark:border-divider-dark rounded-2xl bg-surface-light dark:bg-surface-dark/40 overflow-hidden mb-4 shadow-sm">
                <View className="flex-1 p-5 items-center">
                    <Text className="text-[10px] font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-widest mb-1">Total Words</Text>
                    <Text className="text-3xl font-extrabold text-primary dark:text-primary-dark tracking-tight">{words}</Text>
                </View>
                <View className="w-[1px] bg-divider-light dark:bg-divider-dark my-4" />
                <View className="flex-1 p-5 items-center">
                    <Text className="text-[10px] font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-widest mb-1">Journal Entries</Text>
                    <Text className="text-3xl font-extrabold text-text-primary-light dark:text-text-primary-dark tracking-tight">{entries}</Text>
                </View>
            </View>

            {/* Daily word cylinder activity tracker */}
            <View className="border border-divider-light dark:border-divider-dark rounded-2xl bg-surface-light dark:bg-surface-dark/40 p-5 shadow-sm">
                <View className="flex-row justify-between items-center mb-6">
                    <Text className="text-xs font-bold text-text-primary-light dark:text-text-primary-dark uppercase tracking-wider">Daily Activity</Text>
                    <Text className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-widest font-semibold">Max: {maxWords} words</Text>
                </View>
                <View
                    className="w-full flex-row items-end justify-between px-2 relative"
                    style={{ height: DAILY_WORDS_CONTAINER_HEIGHT }}
                >
                    {dailyWords.map((count, i) => {
                        const barHeight = getDailyBarHeight(count, maxWords);
                        const isToday = i === todayIndex;
                        const hasWords = count > 0;
                        const barColor = isToday
                            ? 'bg-primary'
                            : hasWords
                                ? 'bg-text-secondary-light dark:bg-text-secondary-dark opacity-80'
                                : 'bg-divider-light dark:bg-divider-dark opacity-35';

                        return (
                            <View key={i} className="items-center gap-2 flex-1">
                                <View
                                    className="w-2 rounded-full bg-divider-light/20 dark:bg-divider-dark/20 justify-end overflow-hidden"
                                    style={{ height: DAILY_WORDS_HEIGHT }}
                                >
                                    <View
                                        accessibilityLabel={`${DAY_NAMES[i]} ${count} words`}
                                        accessibilityRole="image"
                                        accessibilityValue={{ now: count, min: 0, max: maxWords }}
                                        testID={`daily-words-bar-${i}`}
                                        className={`w-2 rounded-full ${barColor}`}
                                        style={{ height: barHeight }}
                                    />
                                </View>
                                <Text
                                    className={`text-[10px] font-bold ${isToday
                                            ? 'text-primary'
                                            : 'text-text-secondary-light dark:text-text-secondary-dark'
                                        }`}
                                >
                                    {DAY_LABELS[i]}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            </View>
        </View>
    );
};

export default function InsightsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const iconSecondary = isDark ? '#9CA3AF' : '#6B7280';
    const { insights, weeklyStats, weekDateRange, isLoading } = useWeeklyInsights();
    const { emojiStyle } = useThemeSettings();

    const handleTabPress = (tab: 'today' | 'explore' | 'entries' | 'settings' | 'insights') => {
        if (tab !== 'insights') {
            router.push(`/(tabs)/${tab}`);
        }
    };

    const handleNewEntry = () => {
        router.push('/chat');
    };

    const handleAskRosebud = () => {
        router.push('/ask-rosebud');
    };

    const isLocked = weeklyStats.entriesCount < 5;

    return (
        <ScreenContainer edges="top">
                <View className="px-4 pt-6 flex-1">
                    <Header dateRange={weekDateRange} />

                    <ScrollView
                        className="flex-1"
                        contentContainerStyle={{ paddingBottom: navAwareBottomPadding(insets.bottom) }}
                        showsVerticalScrollIndicator={false}
                    >
                        <SpatialView visible={true}>
                            <AskRosebudCard
                                onPress={handleAskRosebud}
                                iconColor={iconSecondary}
                            />

                            <WeeklyReportCard
                                isLocked={isLocked}
                                entriesNeeded={Math.max(0, 5 - weeklyStats.entriesCount)}
                                entriesCount={weeklyStats.entriesCount}
                                iconColor={iconSecondary}
                                weeklySummary={insights?.weeklySummary}
                            />

                            <WritingStatsCard
                                words={weeklyStats.totalWords}
                                entries={weeklyStats.entriesCount}
                                dailyWords={weeklyStats.dailyWords}
                            />

                            <View className="mb-6">
                                <View className="items-center justify-center mb-4">
                                    <Text className="text-[10px] font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-widest">Your week so far</Text>
                                </View>
                                {isLoading ? (
                                    <View className="bg-surface-light dark:bg-surface-dark/40 border border-divider-light dark:border-divider-dark rounded-2xl p-6 shadow-sm mb-4 h-40 items-center justify-center">
                                        <ActivityIndicator size="small" />
                                        <Text className="text-[10px] font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-widest mt-4">
                                            Analyzing journal...
                                        </Text>
                                    </View>
                                ) : (
                                    <>
                                        <View className="bg-surface-light dark:bg-surface-dark/40 border border-divider-light dark:border-divider-dark rounded-2xl p-5 shadow-sm mb-6">
                                            <Text className="text-xs font-bold text-text-primary-light dark:text-text-primary-dark uppercase tracking-wider mb-4">Emotional Landscape</Text>
                                            <EmotionalLandscapeChart data={insights?.emotionalLandscape || []} emojiStyle={emojiStyle} />
                                        </View>

                                        <KeyThemes themes={insights?.keyThemes || []} />
                                        <View className="h-[1px] bg-divider-light/20 dark:bg-divider-dark/20 my-6" />
                                        <CastOfCharacters characters={insights?.castOfCharacters || []} />
                                    </>
                                )}
                            </View>
                        </SpatialView>
                    </ScrollView>
                </View>

                <BottomNav
                    activeTab="insights"
                    onTabPress={handleTabPress}
                    onFabPress={handleNewEntry}
                />
        </ScreenContainer>
    );
}
