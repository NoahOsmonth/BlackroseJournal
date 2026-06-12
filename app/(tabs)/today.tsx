/**
 * Today Screen
 * Matches updated example design for Today + My Intentions + Goals.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';

import { BottomNav } from '@/components/journal';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { navAwareBottomPadding } from '@/constants/spacing';
import { AppHeader } from '@/components/navigation';
import { GoalQuickAddModal } from '@/components/goals/GoalQuickAddModal';
import {
    EntryInsightsCard,
    GoalsSection,
    IntentionActionCard,
    MyIntentionsSection,
    PersonalizeButton,
} from '@/components/today';
import {
    EveningReflectionIcon,
    MorningIntentionIcon,
} from '@/components/today/TodayActionIcon';
import { useGoals } from '@/hooks/goals/useGoals';
import { useIntentions } from '@/hooks/intentions/useIntentions';
import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import { listCheckInDrafts } from '@/services/intentions/intentionsStorage';
import { useEntryInsightQuestion } from '@/hooks/insights/useEntryInsightQuestion';
import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { useHeaderActions } from '@/hooks/navigation/useHeaderActions';
import { useTabNavigation } from '@/hooks/navigation/useTabNavigation';
import { useSelectedDay } from '@/hooks/today/useSelectedDay';
import { useSavedInsights } from '@/hooks/saved-insights/useSavedInsights';
import { WeekdaySelector } from '@/components/today/WeekdaySelector';
import { getLocalDateKey } from '@/utils/date';
import { calculateStreakStats } from '@/utils/streakStats';
import { SpatialView } from '@/components/ui/SpatialView';
import { StaggerEntrance } from '@/components/ui/StaggerEntrance';

export default function TodayScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { weekDays, selectedDay, selectDay, monthLabel, shortDateLabel } = useSelectedDay();
    const { completed: entries } = useJournalEntries();
    const { completed: checkIns } = useIntentionCheckIns();
    const { activeIntentions } = useIntentions();
    const { goals } = useGoals();
    const { question, refresh, sourceDate } = useEntryInsightQuestion(entries);
    const { add: saveInsight } = useSavedInsights();
    const { openStreakView, openSettings } = useHeaderActions();
    const { goToTab } = useTabNavigation();

    const [showAddGoal, setShowAddGoal] = useState(false);
    const [moreVisible, setMoreVisible] = useState(false);
    const [isInsightHidden, setInsightHidden] = useState(false);

    const dateKey = useMemo(() => getLocalDateKey(selectedDay.date), [selectedDay.date]);

    const completionKeys = useMemo(() => {
        const keys = new Set<string>();
        entries.forEach((entry) => keys.add(getLocalDateKey(new Date(entry.createdAt))));
        checkIns.forEach((checkIn) => keys.add(getLocalDateKey(new Date(checkIn.createdAt))));
        return keys;
    }, [entries, checkIns]);

    const completedDayIndices = useMemo(
        () => weekDays.filter((day) => completionKeys.has(getLocalDateKey(day.date))).map((day) => day.dayIndex),
        [weekDays, completionKeys]
    );

    const streakCount = useMemo(
        () => calculateStreakStats(completionKeys).currentStreak,
        [completionKeys]
    );

    const morningCompleted = useMemo(
        () => checkIns.some((checkIn) => checkIn.type === 'morning'
            && getLocalDateKey(new Date(checkIn.createdAt)) === dateKey),
        [checkIns, dateKey]
    );

    const eveningCompleted = useMemo(
        () => checkIns.some((checkIn) => checkIn.type === 'evening'
            && getLocalDateKey(new Date(checkIn.createdAt)) === dateKey),
        [checkIns, dateKey]
    );

    const goalsForDate = useMemo(
        () => goals.filter((goal) => goal.type === 'goal' && goal.dateKey === dateKey),
        [goals, dateKey]
    );

    const habits = useMemo(
        () => goals.filter((goal) => goal.type === 'habit'),
        [goals]
    );

    const completedGoals = goalsForDate.filter((goal) => goal.completed).length;
    const completedHabits = habits.filter((habit) => (habit.habitCompletions ?? []).includes(dateKey)).length;
    const totalGoals = goalsForDate.length + habits.length;
    const completedCount = completedGoals + completedHabits;

    const handleTabPress = (tab: 'today' | 'explore' | 'entries' | 'settings' | 'insights') => {
        if (tab !== 'today') {
            goToTab(tab);
        }
    };

    // Re-open today's unfinished check-in draft (saved when the chat was
    // closed mid-conversation) instead of always starting a fresh session.
    const openDailyCheckIn = async (type: 'morning' | 'evening') => {
        const todayKey = getLocalDateKey(new Date());
        const draftsList = await listCheckInDrafts();
        const draft = draftsList.find((item) => item.type === type
            && getLocalDateKey(new Date(item.updatedAt)) === todayKey);
        if (draft) {
            router.push({
                pathname: '/intentions/chat',
                params: {
                    draftId: draft.id,
                    type,
                    ...(draft.intentionId ? { intentionId: draft.intentionId } : {}),
                },
            });
            return;
        }
        router.push({ pathname: '/intentions/chat', params: { type } });
    };

    const handleMorningPress = () => {
        void openDailyCheckIn('morning');
    };

    const handleEveningPress = () => {
        void openDailyCheckIn('evening');
    };

    const handleAddIntention = () => {
        router.push('/intentions/select');
    };

    const handleSelectIntention = (id: string) => {
        router.push({ pathname: '/intentions/detail', params: { id } });
    };

    const handleAddGoal = () => {
        setShowAddGoal(true);
    };

    const handleManageGoals = () => {
        router.push('/goals');
    };

    const handleAddGoalSubmit = async (title: string, type: 'goal' | 'habit') => {
        setShowAddGoal(false);
        const { createGoal } = await import('@/services/goals/goalsStorage');
        await createGoal({ title, type, dateKey: type === 'goal' ? dateKey : undefined });
    };

    const handleBookmark = async () => {
        await saveInsight({ question, sourceDate });
    };

    const handleShare = async () => {
        await Share.share({ message: question });
        setMoreVisible(false);
    };

    const handleCopy = async () => {
        await Clipboard.setStringAsync(question);
        setMoreVisible(false);
    };

    const handleHide = () => {
        setInsightHidden(true);
        setMoreVisible(false);
    };

    const handleShowSavedInsights = () => {
        router.push('/saved-insights');
        setMoreVisible(false);
    };

    return (
        <ScreenContainer edges="top">
                <AppHeader
                    variant="today"
                    title={monthLabel}
                    streakCount={streakCount}
                    onLeftPress={openStreakView}
                    onRightPress={openSettings}
                />

                <ScrollView
                    className="flex-1 px-5"
                    contentContainerStyle={{ paddingBottom: navAwareBottomPadding(insets.bottom) }}
                    showsVerticalScrollIndicator={false}
                >
                    <SpatialView visible={true}>
                        <WeekdaySelector
                            weekDays={weekDays}
                            selectedDayIndex={selectedDay.dayIndex}
                            onDaySelect={selectDay}
                            completedDayIndices={completedDayIndices}
                        />

                        <View className="items-center justify-center mt-6">
                            <Text className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">
                                Today {shortDateLabel}
                            </Text>
                        </View>

                        <StaggerEntrance
                            columns={2}
                            staggerType="diagonal"
                            className="mt-6 justify-between w-full"
                        >
                            <View className="w-full">
                                <IntentionActionCard
                                    title={'Morning\nIntention'}
                                    subtitle="Start your day"
                                    icon={<MorningIntentionIcon />}
                                    onPress={handleMorningPress}
                                    isCompleted={morningCompleted}
                                />
                            </View>
                            <View className="w-full">
                                <IntentionActionCard
                                    title={'Evening\nReflection'}
                                    subtitle="Reflect & unwind"
                                    icon={<EveningReflectionIcon />}
                                    onPress={handleEveningPress}
                                    isCompleted={eveningCompleted}
                                />
                            </View>
                        </StaggerEntrance>

                        <StaggerEntrance
                            columns={1}
                            staggerType="linear"
                            className="mt-8"
                        >
                            <View className="w-full mb-8">
                                <MyIntentionsSection
                                    intentions={activeIntentions}
                                    onAdd={handleAddIntention}
                                    onSelect={(intention) => handleSelectIntention(intention.id)}
                                />
                            </View>

                            <View className="w-full mb-8">
                                <GoalsSection
                                    completedCount={completedCount}
                                    totalCount={totalGoals}
                                    onAddGoal={handleAddGoal}
                                    onManage={handleManageGoals}
                                />
                            </View>

                            {!isInsightHidden ? (
                                <View className="w-full mb-8">
                                    <EntryInsightsCard
                                        question={question}
                                        onRefresh={refresh}
                                        onBookmark={handleBookmark}
                                        onMore={() => setMoreVisible(true)}
                                    />
                                </View>
                            ) : null}

                            <PersonalizeButton onPress={openSettings} />
                        </StaggerEntrance>
                    </SpatialView>
                </ScrollView>

                <BottomNav
                    activeTab="today"
                    onTabPress={handleTabPress}
                    onFabPress={() => router.push('/chat')}
                />

                <GoalQuickAddModal
                    visible={showAddGoal}
                    onClose={() => setShowAddGoal(false)}
                    onSubmit={handleAddGoalSubmit}
                />

                {moreVisible && (
                    <View className="absolute inset-0 bg-black/40 justify-end">
                        <View
                            className="bg-surface-light dark:bg-surface-dark rounded-t-3xl p-6"
                            style={{ paddingBottom: insets.bottom + 24 }}
                        >
                            <Text className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide mb-4">
                                More options
                            </Text>
                            <Pressable onPress={handleShare} className="py-3">
                                <Text className="text-base text-text-light dark:text-text-dark">Share</Text>
                            </Pressable>
                            <Pressable onPress={handleCopy} className="py-3">
                                <Text className="text-base text-text-light dark:text-text-dark">Copy</Text>
                            </Pressable>
                            <Pressable onPress={handleHide} className="py-3">
                                <Text className="text-base text-text-light dark:text-text-dark">Hide for today</Text>
                            </Pressable>
                            <Pressable onPress={handleShowSavedInsights} className="py-3">
                                <Text className="text-base text-text-light dark:text-text-dark">Saved insights</Text>
                            </Pressable>
                            <Pressable onPress={() => setMoreVisible(false)} className="py-3">
                                <Text className="text-base text-text-secondary-light dark:text-text-secondary-dark">Cancel</Text>
                            </Pressable>
                        </View>
                    </View>
                )}
        </ScreenContainer>
    );
}
