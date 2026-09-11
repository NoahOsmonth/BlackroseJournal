/**
 * Today Screen
 * Daily home: writing card, morning/evening rituals, intentions, and (only when
 * they exist) today's goals plus the entry insight.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';

import { BottomNav } from '@/components/journal';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { navAwareBottomPadding, SCREEN_PADDING_X } from '@/constants/spacing';
import { AppHeader } from '@/components/navigation';
import { GoalQuickAddModal } from '@/components/goals/GoalQuickAddModal';
import {
    EntryInsightsCard,
    GoalsSection,
    InsightMoreOptionsModal,
    MyIntentionsSection,
    TodayRitualRow,
    TodayWritingCard,
    buildGoalListItems,
} from '@/components/today';
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
import { getLocalDateKey } from '@/utils/date';
import { calculateStreakStats } from '@/utils/streakStats';
import { SpatialView } from '@/components/ui/SpatialView';
import { RevealItem } from '@/components/ui/RevealItem';
import { useScrollReveal } from '@/components/ui/useScrollReveal';
import { TodaySkeleton } from '@/components/today/TodaySkeleton';

export default function TodayScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { scrollY, onScroll } = useScrollReveal();
    const { selectedDay, serifDateLabel } = useSelectedDay();
    const { completed: entries, refresh: refreshEntries, isLoading: entriesLoading } = useJournalEntries();
    const { completed: checkIns, refresh: refreshCheckIns, isLoading: checkInsLoading } = useIntentionCheckIns();
    const { activeIntentions, refresh: refreshIntentions, isLoading: intentionsLoading } = useIntentions();
    const { goals, toggle: toggleGoal, refresh: refreshGoals, isLoading: goalsLoading } = useGoals();
    const { question, refresh, sourceDate } = useEntryInsightQuestion(entries);
    const { add: saveInsight, isLoading: insightsLoading } = useSavedInsights();
    const { openStreakView, openSettings } = useHeaderActions();
    const { goToTab } = useTabNavigation();

    const isLoading = entriesLoading || checkInsLoading || intentionsLoading || goalsLoading || insightsLoading;

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

    const handleWritePress = () => {
        router.push('/chat');
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
                streakCount={streakCount}
                onLeftPress={openStreakView}
                onRightPress={openSettings}
            />

            {isLoading ? (
                <TodaySkeleton />
            ) : (
                <>
                    <Animated.ScrollView
                        className="flex-1"
                        contentContainerStyle={{
                            paddingHorizontal: SCREEN_PADDING_X,
                            paddingBottom: navAwareBottomPadding(insets.bottom),
                        }}
                        showsVerticalScrollIndicator={false}
                        onScroll={onScroll}
                        scrollEventThrottle={16}
                    >
                        <SpatialView visible={true}>
                            <View className="gap-6">
                                {/* One serif moment: the date headline. */}
                                <RevealItem scrollY={scrollY}>
                                    <Text
                                        className="text-[38px] leading-tight text-text-light dark:text-text-dark"
                                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                                    >
                                        {serifDateLabel}
                                    </Text>
                                </RevealItem>

                                <RevealItem scrollY={scrollY}>
                                    <TodayWritingCard onPress={handleWritePress} />
                                </RevealItem>

                                <RevealItem scrollY={scrollY}>
                                    <View className="overflow-hidden rounded-card border border-hairline-light dark:border-hairline-dark">
                                        <TodayRitualRow
                                            title="Morning note"
                                            onPress={handleMorningPress}
                                            isCompleted={morningCompleted}
                                            testID="today-ritual-morning"
                                        />
                                        <TodayRitualRow
                                            title="Evening close"
                                            onPress={handleEveningPress}
                                            isCompleted={eveningCompleted}
                                            showDivider={false}
                                            testID="today-ritual-evening"
                                        />
                                    </View>
                                </RevealItem>

                                <RevealItem scrollY={scrollY}>
                                    <MyIntentionsSection
                                        intentions={activeIntentions}
                                        onAdd={handleAddIntention}
                                        onSelect={(intention) => handleSelectIntention(intention.id)}
                                    />
                                </RevealItem>

                                {goalListItems.length > 0 ? (
                                    <RevealItem scrollY={scrollY}>
                                        <GoalsSection
                                            items={goalListItems}
                                            onAddGoal={handleAddGoal}
                                            onManage={handleManageGoals}
                                            onToggle={handleToggleGoal}
                                        />
                                    </RevealItem>
                                ) : null}

                                {!isInsightHidden ? (
                                    <RevealItem scrollY={scrollY}>
                                        <EntryInsightsCard
                                            question={question}
                                            onRefresh={refresh}
                                            onBookmark={handleBookmark}
                                            onMore={() => setMoreVisible(true)}
                                            onPress={handleInsightPress}
                                        />
                                    </RevealItem>
                                ) : null}
                            </View>
                        </SpatialView>
                    </Animated.ScrollView>

                    <BottomNav
                        activeTab="today"
                        onTabPress={handleTabPress}
                        onFabPress={handleWritePress}
                    />
                </>
            )}

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
