/**
 * Today Screen
 * Daily home: week strip, morning/evening rituals, intentions, goals, insight.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
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
    InsightMoreOptionsModal,
    IntentionActionCard,
    MyIntentionsSection,
    buildGoalListItems,
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

export default function TodayScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { weekDays, selectedDay, selectDay, monthLabel, shortDateLabel } = useSelectedDay();
    const { completed: entries, refresh: refreshEntries } = useJournalEntries();
    const { completed: checkIns, refresh: refreshCheckIns } = useIntentionCheckIns();
    const { activeIntentions, refresh: refreshIntentions } = useIntentions();
    const { goals, toggle: toggleGoal, refresh: refreshGoals } = useGoals();
    const { question, refresh, sourceDate } = useEntryInsightQuestion(entries);
    const { add: saveInsight } = useSavedInsights();
    const { openStreakView, openSettings } = useHeaderActions();
    const { goToTab } = useTabNavigation();

    const refreshAll = useCallback(() => {
        void refreshEntries();
        void refreshCheckIns();
        void refreshIntentions();
        void refreshGoals();
    }, [refreshEntries, refreshCheckIns, refreshIntentions, refreshGoals]);

    useFocusEffect(refreshAll);

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

    const goalListItems = useMemo(
        () => buildGoalListItems(goalsForDate, habits, dateKey),
        [goalsForDate, habits, dateKey]
    );

    const handleTabPress = (tab: 'today' | 'explore' | 'entries' | 'settings' | 'insights') => {
        if (tab !== 'today') {
            goToTab(tab);
        }
    };

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
        await refreshGoals();
    };

    const handleToggleGoal = (id: string) => {
        void toggleGoal(id, dateKey);
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

    const handleInsightPress = () => {
        router.push({ pathname: '/chat', params: { topic: question } });
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
                className="flex-1 px-4"
                contentContainerStyle={{ paddingBottom: navAwareBottomPadding(insets.bottom) }}
                showsVerticalScrollIndicator={false}
            >
                <SpatialView visible={true}>
                    <View className="gap-6">
                        <WeekdaySelector
                            weekDays={weekDays}
                            selectedDayIndex={selectedDay.dayIndex}
                            onDaySelect={selectDay}
                            completedDayIndices={completedDayIndices}
                        />

                        <View className="items-center justify-center">
                            <Text className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">
                                Today {shortDateLabel}
                            </Text>
                        </View>

                        <View className="flex-row gap-4">
                            <IntentionActionCard
                                title={'Morning\nIntention'}
                                subtitle="Start your day"
                                icon={<MorningIntentionIcon />}
                                onPress={handleMorningPress}
                                isCompleted={morningCompleted}
                            />
                            <IntentionActionCard
                                title={'Evening\nReflection'}
                                subtitle="Reflect & unwind"
                                icon={<EveningReflectionIcon />}
                                onPress={handleEveningPress}
                                isCompleted={eveningCompleted}
                            />
                        </View>

                        <MyIntentionsSection
                            intentions={activeIntentions}
                            onAdd={handleAddIntention}
                            onSelect={(intention) => handleSelectIntention(intention.id)}
                        />

                        <GoalsSection
                            items={goalListItems}
                            onAddGoal={handleAddGoal}
                            onManage={handleManageGoals}
                            onToggle={handleToggleGoal}
                        />

                        {!isInsightHidden ? (
                            <EntryInsightsCard
                                question={question}
                                onRefresh={refresh}
                                onBookmark={handleBookmark}
                                onMore={() => setMoreVisible(true)}
                                onPress={handleInsightPress}
                            />
                        ) : null}
                    </View>
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

            <InsightMoreOptionsModal
                visible={moreVisible}
                onClose={() => setMoreVisible(false)}
                onShare={handleShare}
                onCopy={handleCopy}
                onHide={handleHide}
                onShowSavedInsights={handleShowSavedInsights}
            />
        </ScreenContainer>
    );
}
