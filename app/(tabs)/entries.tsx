import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import { AppHeader } from '@/components/navigation';
import { BottomNav, ResumeSessionBanner } from '@/components/journal';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { RevealItem } from '@/components/ui/RevealItem';
import { useScrollReveal } from '@/components/ui/useScrollReveal';
import { StaggerEntranceItem } from '@/components/ui/StaggerEntrance';
import { navAwareBottomPadding } from '@/constants/spacing';
import { HistorySection } from '@/components/history/HistorySection';
import { HistoryWeekRhythm } from '@/components/history/HistoryWeekRhythm';
import { HistoryFilterBar } from '@/components/history/HistoryFilterBar';
import { HistoryMonthBreak } from '@/components/history/HistoryMonthBreak';
import { HistoryEmpty } from '@/components/history/HistoryEmpty';
import { HistorySkeleton } from '@/components/history/HistorySkeleton';
import { useHistoryFeed } from '@/hooks/history/useHistoryFeed';
import {
    filterHistorySections,
    formatMonthYear,
    HistoryFilter,
    HistoryItem,
    HistorySection as HistorySectionModel,
} from '@/hooks/history/historyUtils';
import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import { useTabNavigation } from '@/hooks/navigation/useTabNavigation';
import {
    getMostRecentActiveSession,
    type ChatSession,
} from '@/services/ai/sessionStorage';

const STAGGER_CAP = 6;

function sessionTitle(session: ChatSession): string {
    const lastUser = [...session.messages].reverse().find((m) => m.role === 'user');
    const text = (lastUser ?? session.messages[session.messages.length - 1])?.content.trim() ?? '';
    if (!text) return 'Tap to continue';
    return text.length > 80 ? `${text.slice(0, 80).trim()}...` : text;
}

function isIntentionSession(session: ChatSession): boolean {
    return session.mode === 'morning'
        || session.mode === 'evening'
        || session.mode === 'intention';
}

type FeedRow =
    | { kind: 'month'; key: string; label: string }
    | { kind: 'section'; key: string; section: HistorySectionModel };

function buildFeedRows(sections: HistorySectionModel[]): FeedRow[] {
    const rows: FeedRow[] = [];
    let previousMonthKey: string | null = null;

    sections.forEach((section) => {
        if (previousMonthKey !== null && section.monthKey !== previousMonthKey) {
            rows.push({
                kind: 'month',
                key: `month-${section.monthKey}-${section.dateKey}`,
                label: section.monthLabel,
            });
        }
        previousMonthKey = section.monthKey;
        rows.push({
            kind: 'section',
            key: section.dateKey,
            section,
        });
    });

    return rows;
}

export default function EntriesScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { scrollY, onScroll } = useScrollReveal();
    const { sections, weeklySummary, isLoading } = useHistoryFeed();
    const { drafts, refresh: refreshEntries } = useJournalEntries();
    const { drafts: checkInDrafts, refresh: refreshCheckIns } = useIntentionCheckIns();
    const { goToTab } = useTabNavigation();

    const draftCount = drafts.length + checkInDrafts.length;
    const monthLabel = formatMonthYear(new Date());

    const [filter, setFilter] = useState<HistoryFilter>('all');
    const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
    const [dismissedId, setDismissedId] = useState<string | null>(null);

    useFocusEffect(
        useCallback(() => {
            let isActive = true;
            void refreshEntries();
            void refreshCheckIns();
            getMostRecentActiveSession().then((session) => {
                if (isActive) setActiveSession(session);
            });
            return () => {
                isActive = false;
            };
        }, [refreshEntries, refreshCheckIns])
    );

    const showBanner = activeSession !== null
        && activeSession.conversationId !== dismissedId;

    const filteredSections = useMemo(
        () => filterHistorySections(sections, filter),
        [sections, filter]
    );

    const feedRows = useMemo(
        () => buildFeedRows(filteredSections),
        [filteredSections]
    );

    const handleResumeSession = () => {
        if (!activeSession) return;
        if (isIntentionSession(activeSession)) {
            router.push({
                pathname: '/intentions/chat',
                params: { resume: activeSession.conversationId, ...activeSession.routeParams },
            });
            return;
        }
        router.push({ pathname: '/chat', params: { resume: activeSession.conversationId } });
    };

    const handleTabPress = (tab: 'today' | 'explore' | 'entries' | 'settings' | 'insights') => {
        if (tab !== 'entries') {
            goToTab(tab);
        }
    };

    const handlePressItem = useCallback((item: HistoryItem) => {
        if (item.type === 'journal') {
            router.push({ pathname: '/entry-detail', params: { id: item.sourceId } });
            return;
        }
        if (item.intentionId) {
            router.push({ pathname: '/intentions/detail', params: { id: item.intentionId } });
            return;
        }
        router.push({ pathname: '/checkin-detail', params: { id: item.sourceId } });
    }, [router]);

    const hasAnyItems = sections.length > 0;
    const isEmpty = !isLoading && filteredSections.length === 0;

    return (
        <ScreenContainer edges="top">
            <AppHeader
                variant="history"
                monthLabel={monthLabel}
                draftCount={draftCount}
                onDraftsPress={() => router.push('/drafts')}
            />

            <Animated.ScrollView
                className="flex-1 px-4"
                contentContainerStyle={{ paddingBottom: navAwareBottomPadding(insets.bottom) }}
                showsVerticalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
            >
                {showBanner && activeSession ? (
                    <RevealItem scrollY={scrollY}>
                        <View className="mt-1 mb-3">
                            <ResumeSessionBanner
                                title={sessionTitle(activeSession)}
                                onResume={handleResumeSession}
                                onDismiss={() => setDismissedId(activeSession.conversationId)}
                            />
                        </View>
                    </RevealItem>
                ) : null}

                <RevealItem scrollY={scrollY}>
                    <View className="mt-1 mb-4">
                        <HistoryWeekRhythm summary={weeklySummary} />
                    </View>
                </RevealItem>

                {hasAnyItems ? (
                    <RevealItem scrollY={scrollY}>
                        <View className="mb-5">
                            <HistoryFilterBar value={filter} onChange={setFilter} />
                        </View>
                    </RevealItem>
                ) : null}

                {isLoading && !hasAnyItems ? (
                    <HistorySkeleton />
                ) : isEmpty ? (
                    <HistoryEmpty
                        filter={filter}
                        hasAnyItems={hasAnyItems}
                        onWritePress={() => router.push('/chat')}
                    />
                ) : (
                    <View className="gap-6">
                        {feedRows.map((row, index) => {
                            const content = row.kind === 'month' ? (
                                <HistoryMonthBreak label={row.label} />
                            ) : (
                                <HistorySection
                                    section={row.section}
                                    onPressItem={handlePressItem}
                                />
                            );

                            if (index >= STAGGER_CAP) {
                                return <View key={row.key}>{content}</View>;
                            }

                            return (
                                <StaggerEntranceItem
                                    key={row.key}
                                    index={index}
                                    columns={1}
                                    totalItems={Math.min(feedRows.length, STAGGER_CAP)}
                                    staggerType="linear"
                                    baseDelayMs={30}
                                    delayFactorMs={50}
                                    className="w-full"
                                >
                                    {content}
                                </StaggerEntranceItem>
                            );
                        })}
                    </View>
                )}
            </Animated.ScrollView>

            <BottomNav
                activeTab="entries"
                onTabPress={handleTabPress}
                onFabPress={() => router.push('/chat')}
            />
        </ScreenContainer>
    );
}
