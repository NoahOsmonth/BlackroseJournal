/**
 * Today Screen
 * Main dashboard with daily check-in, stats, happiness recipe, and Ask Rosebud
 * Matches example-design/today.html
 */

import { BottomNav } from '@/components/journal';
import { AppHeader } from '@/components/navigation';
import { EntriesModal, StreakModal, WordsModal } from '@/components/stats';
import {
    AskRosebudSection,
    DailyJournalingCard,
    HappinessRecipeSection,
    StatCardsGrid,
    TimeRange,
    WeekdaySelector,
} from '@/components/today';
import { selectDailyPrompt } from '@/constants/dailyPrompts';
import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { useHeaderActions } from '@/hooks/navigation/useHeaderActions';
import { useTabNavigation } from '@/hooks/navigation/useTabNavigation';
import { useSelectedDay } from '@/hooks/today/useSelectedDay';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TodayScreen() {
    const router = useRouter();
    const { weekDays, selectedDay, selectDay, formattedDate } = useSelectedDay();
    const { completed } = useJournalEntries();
    const { openRewards, openSettings } = useHeaderActions();
    const { goToTab } = useTabNavigation();
    const [timeRange, setTimeRange] = useState<TimeRange>('all-time');

    // Modal visibility state
    const [streakModalVisible, setStreakModalVisible] = useState(false);
    const [entriesModalVisible, setEntriesModalVisible] = useState(false);
    const [wordsModalVisible, setWordsModalVisible] = useState(false);

    // Calculate stats from entries
    const stats = useMemo(() => {
        const totalEntries = completed.length;
        const totalWords = completed.reduce((sum, entry) => {
            const wordCount = entry.messages
                .filter((m) => m.role === 'user')
                .reduce((acc, m) => acc + m.content.split(/\s+/).filter(Boolean).length, 0);
            return sum + wordCount;
        }, 0);

        // Calculate streak (consecutive days with entries)
        // Simple implementation - counts consecutive days ending today
        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const entriesByDate = new Map<string, boolean>();
        completed.forEach((entry) => {
            const date = new Date(entry.createdAt);
            date.setHours(0, 0, 0, 0);
            entriesByDate.set(date.toDateString(), true);
        });

        const checkDate = new Date(today);
        while (entriesByDate.has(checkDate.toDateString())) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        }

        return { streak, entries: totalEntries, words: totalWords };
    }, [completed]);

    // Time-based prompt selection using the centralized daily prompts
    const dailyPrompt = useMemo(() => selectDailyPrompt(), []);

    // Handlers
    const handleNewEntry = () => {
        router.push('/chat');
    };

    const handleCheckIn = () => {
        // Navigate to chat with daily check-in mode and prompt period
        router.push({
            pathname: '/chat',
            params: {
                mode: 'dailyCheckIn',
                promptPeriod: dailyPrompt.period,
            },
        });
    };

    const handleTabPress = (tab: 'today' | 'explore' | 'entries' | 'settings' | 'insights') => {
        if (tab !== 'today') {
            goToTab(tab);
        }
    };

    const handleStreakPress = () => {
        setStreakModalVisible(true);
    };

    const handleEntriesPress = () => {
        setEntriesModalVisible(true);
    };

    const handleWordsPress = () => {
        setWordsModalVisible(true);
    };

    const handleCompletedPress = () => {
        router.push('/happiness-recipe');
    };

    const handleAddIngredient = () => {
        router.push('/happiness-recipe');
    };

    const handleAddGoal = () => {
        router.push('/happiness-recipe');
    };

    const handleEditRecipe = () => {
        router.push('/happiness-recipe');
    };

    const handleTimeRangePress = () => {
        // TODO: Open time range picker (Task 006)
        // Cycle through for now
        const ranges: TimeRange[] = ['all-time', 'this-year', 'this-month', 'this-week'];
        const currentIndex = ranges.indexOf(timeRange);
        setTimeRange(ranges[(currentIndex + 1) % ranges.length]);
    };

    const handleAskRosebudPress = () => {
        router.push('/ask-rosebud');
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full">
                <AppHeader
                    title={formattedDate}
                    variant="today"
                    onLeftPress={openRewards}
                    onRightPress={openSettings}
                />

                <ScrollView
                    className="flex-1 px-4"
                    contentContainerStyle={{ paddingBottom: 140 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Weekday selector */}
                    <WeekdaySelector
                        weekDays={weekDays}
                        selectedDayIndex={selectedDay.dayIndex}
                        onDaySelect={selectDay}
                        onCalendarPress={() => goToTab('entries')}
                    />

                    {/* Stats cards */}
                    <View className="mt-4">
                        <StatCardsGrid
                            streak={stats.streak}
                            entries={stats.entries}
                            words={stats.words}
                            onStreakPress={handleStreakPress}
                            onEntriesPress={handleEntriesPress}
                            onWordsPress={handleWordsPress}
                        />
                    </View>

                    {/* Daily journaling card */}
                    <View className="mt-6">
                        <DailyJournalingCard
                            promptTitle={dailyPrompt.title}
                            promptDescription={dailyPrompt.promptText}
                            onCheckIn={handleCheckIn}
                        />
                    </View>

                    {/* Happiness recipe section */}
                    <View className="mt-6">
                        <HappinessRecipeSection
                            completedCount={3}
                            onCompletedPress={handleCompletedPress}
                            onAddIngredient={handleAddIngredient}
                            onAddGoal={handleAddGoal}
                            onEditPress={handleEditRecipe}
                        />
                    </View>

                    {/* Ask Rosebud section */}
                    <View className="mt-6">
                        <AskRosebudSection
                            selectedTimeRange={timeRange}
                            onTimeRangePress={handleTimeRangePress}
                            onSectionPress={handleAskRosebudPress}
                        />
                    </View>

                    {/* Bottom spacer */}
                    <View className="h-6" />
                </ScrollView>

                <BottomNav
                    activeTab="today"
                    onTabPress={handleTabPress}
                    onFabPress={handleNewEntry}
                />

                {/* Stats Modals */}
                <StreakModal
                    visible={streakModalVisible}
                    onClose={() => setStreakModalVisible(false)}
                    entries={completed}
                />
                <EntriesModal
                    visible={entriesModalVisible}
                    onClose={() => setEntriesModalVisible(false)}
                    entries={completed}
                />
                <WordsModal
                    visible={wordsModalVisible}
                    onClose={() => setWordsModalVisible(false)}
                    entries={completed}
                />
            </View>
        </SafeAreaView>
    );
}
