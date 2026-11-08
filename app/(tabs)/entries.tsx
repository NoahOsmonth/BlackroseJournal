import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FinishBackgroundBanner } from '@/components/entries/FinishBackgroundBanner';
import { HistoryEmpty } from '@/components/history/HistoryEmpty';
import { HistoryMonthBreak } from '@/components/history/HistoryMonthBreak';
import { HistorySection } from '@/components/history/HistorySection';
import { HistorySkeleton } from '@/components/history/HistorySkeleton';
import { BottomNav, ResumeSessionBanner } from '@/components/journal';
import { AppHeader } from '@/components/navigation';
import { RevealItem } from '@/components/ui/RevealItem';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { StaggerEntranceItem } from '@/components/ui/StaggerEntrance';
import { useScrollReveal } from '@/components/ui/useScrollReveal';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { navAwareBottomPadding, SCREEN_PADDING_X } from '@/constants/spacing';
import {
    formatWeekMeta,
    HistoryItem,
    HistorySection as HistorySectionModel,
} from '@/hooks/history/historyUtils';
import { useHistoryFeed } from '@/hooks/history/useHistoryFeed';
import { useStarredEntries } from '@/hooks/journal/useStarredEntries';
import { filterStarredSections } from '@/utils/starredSections';
import {
    collectTopicChips,
    countTopicItems,
    filterSectionsByTopic,
    normalizeTopic,
} from '@/utils/topicChips';
import { useTabNavigation } from '@/hooks/navigation/useTabNavigation';
import { useColorScheme } from '@/hooks/theme/use-color-scheme';
import { sessionTitle } from '@/utils/sessionTitle';
import {
    getMostRecentActiveSession,
    type ChatSession,
} from '@/services/ai/sessionStorage';

const STAGGER_CAP = 6;

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
    const isDark = useColorScheme() === 'dark';
    const placeholderColor = isDark
        ? BLACKROSE_PALETTE.dark.text2
        : BLACKROSE_PALETTE.light.text2;
    const { scrollY, onScroll } = useScrollReveal();
    const {
        sections,
        searchSections,
        weeklySummary,
        draftCount,
        isLoading,
        refresh: refreshFeed,
    } = useHistoryFeed();
    const { goToTab } = useTabNavigation();

    // The feed below is every entry ever written, grouped by day - it is not
    // filtered to this week. Say so in the header rather than printing a bare
    // "This week" above rows that reach back past it.
    const spansBeforeThisWeek = useMemo(() => {
        const weekStart = weeklySummary.weekDayKeys[0];
        if (!weekStart) return false;
        return sections.some((section) => section.dateKey < weekStart);
    }, [sections, weeklySummary.weekDayKeys]);
    const weekLabel = formatWeekMeta(weeklySummary, { spansBeforeThisWeek });

    const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
    const [dismissedId, setDismissedId] = useState<string | null>(null);
    const [showStarredOnly, setShowStarredOnly] = useState(false);
    const [activeTopic, setActiveTopic] = useState('');
    const { starredIds, starredSet } = useStarredEntries();

    useFocusEffect(
        useCallback(() => {
            let isActive = true;
            void refreshFeed();
            getMostRecentActiveSession().then((session) => {
                if (isActive) setActiveSession(session);
            });
            return () => {
                isActive = false;
            };
        }, [refreshFeed])
    );

    const showBanner = activeSession !== null
        && activeSession.conversationId !== dismissedId;

    // Bound to the hook's memoized corpus, so every word in every completed
    // entry/check-in is searchable without a second storage read.
    const filteredSections = useMemo(
        () => searchSections(query),
        [searchSections, query]
    );

    // Order matters: search narrows the corpus first, then the starred filter,
    // then the topic. Chips are derived from THAT narrowed feed, so a chip's
    // number always says how many entries are actually behind it.
    const beforeTopicSections = useMemo(
        () => (showStarredOnly ? filterStarredSections(filteredSections, starredSet) : filteredSections),
        [showStarredOnly, filteredSections, starredSet]
    );

    const topicChips = useMemo(
        () => collectTopicChips(beforeTopicSections),
        [beforeTopicSections]
    );

    const visibleSections = useMemo(
        () => (activeTopic ? filterSectionsByTopic(beforeTopicSections, activeTopic) : beforeTopicSections),
        [activeTopic, beforeTopicSections]
    );

    const feedRows = useMemo(
        () => buildFeedRows(visibleSections),
        [visibleSections]
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
    const isSearching = query.trim().length > 0;
    const isEmpty = !isLoading && visibleSections.length === 0;
    const nothingStarred = showStarredOnly && starredIds.length === 0;
    const noTopicMatches = normalizeTopic(activeTopic).length > 0
        && countTopicItems(beforeTopicSections, activeTopic) === 0;
    const activeTopicLabel = topicChips.find((chip) => chip.label === activeTopic)?.label
        ?? normalizeTopic(activeTopic);

    return (
        <ScreenContainer edges="top">
            <AppHeader
                variant="history"
                weekLabel={weekLabel}
                draftCount={draftCount}
                onDraftsPress={() => router.push('/drafts')}
                onSearchPress={() => setSearchOpen((open) => !open)}
            />

            <View className="px-6 pb-1 pt-1">
                <View className="flex-row flex-wrap items-center gap-2">
                    <Pressable
                        onPress={() => setShowStarredOnly((value) => !value)}
                        accessibilityRole="button"
                        accessibilityLabel={showStarredOnly ? 'Show every entry' : 'Show only starred entries'}
                        accessibilityState={{ selected: showStarredOnly }}
                        testID="archive-starred-filter"
                        className={`min-h-11 justify-center rounded-control border px-3 ${
                            showStarredOnly
                                ? 'border-starred-border bg-surface-light dark:border-starred-border-dark dark:bg-surface-dark'
                                : 'border-hairline-light bg-background-light dark:border-hairline-dark dark:bg-background-dark'
                        }`}
                    >
                        <Text className={`text-[14px] ${
                            showStarredOnly
                                ? 'text-text-light dark:text-text-dark'
                                : 'text-text-secondary-light dark:text-text-secondary-dark'
                        }`}>
                            {showStarredOnly
                                ? `Starred · ${starredIds.length} shown`
                                : `Starred · ${starredIds.length}`}
                        </Text>
                    </Pressable>
                </View>
            </View>

            {topicChips.length > 0 ? (
                <View className="pb-1 pt-1" testID="archive-topic-row">
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING_X, gap: 8 }}
                        accessibilityLabel="Browse by topic"
                    >
                        <Pressable
                            onPress={() => setActiveTopic('')}
                            accessibilityRole="button"
                            accessibilityLabel="Show every topic"
                            accessibilityState={{ selected: normalizeTopic(activeTopic).length === 0 }}
                            testID="topic-chip-all"
                            className={`min-h-11 justify-center rounded-full border px-4 ${
                                normalizeTopic(activeTopic).length === 0
                                    ? 'border-accent-green bg-surface-light dark:border-accent-green-dark dark:bg-surface-dark'
                                    : 'border-hairline-light bg-background-light dark:border-hairline-dark dark:bg-background-dark'
                            }`}
                        >
                            <Text className="text-[14px] text-text-light dark:text-text-dark">All</Text>
                        </Pressable>
                        {topicChips.map((chip) => {
                            const selected = activeTopic === chip.label;
                            const shown = countTopicItems(beforeTopicSections, chip.label);
                            return (
                                <Pressable
                                    key={chip.label}
                                    onPress={() => setActiveTopic(selected ? '' : chip.label)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Topic ${chip.label}, ${shown} ${shown === 1 ? 'entry' : 'entries'}`}
                                    accessibilityState={{ selected }}
                                    testID={`topic-chip-${chip.label}`}
                                    className={`min-h-11 justify-center rounded-full border px-4 ${
                                        selected
                                            ? 'border-accent-green bg-surface-light dark:border-accent-green-dark dark:bg-surface-dark'
                                            : 'border-hairline-light bg-background-light dark:border-hairline-dark dark:bg-background-dark'
                                    }`}
                                >
                                    <Text className="text-[14px] text-text-light dark:text-text-dark">
                                        {chip.label} · {shown}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </View>
            ) : null}

            {searchOpen ? (
                <View className="px-6 pt-3">
                    <View className="rounded-control border border-hairline-light px-4 py-2.5 dark:border-hairline-dark">
                        <TextInput
                            value={query}
                            onChangeText={setQuery}
                            placeholder="Search entries…"
                            placeholderTextColor={placeholderColor}
                            className="text-[15px] text-text-light dark:text-text-dark"
                            accessibilityLabel="Search entries"
                            autoFocus
                        />
                    </View>
                </View>
            ) : null}

            <FinishBackgroundBanner />

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
                {showBanner && activeSession ? (
                    <RevealItem scrollY={scrollY}>
                        <View className="mt-1 mb-3">
                            <ResumeSessionBanner
                                title={sessionTitle(activeSession, 'Tap to continue')}
                                onResume={handleResumeSession}
                                onDismiss={() => setDismissedId(activeSession.conversationId)}
                            />
                        </View>
                    </RevealItem>
                ) : null}

                {isLoading && !hasAnyItems ? (
                    <HistorySkeleton />
                ) : isEmpty ? (
                    noTopicMatches ? (
                        <View className="items-center px-8 pt-16" testID="archive-topic-empty">
                            <Text
                                className="text-center text-[22px] text-text-light dark:text-text-dark"
                                style={{ fontFamily: 'PlayfairDisplayRegular' }}
                            >
                                Nothing here about {activeTopicLabel}
                            </Text>
                            <Text className="mt-3 text-center text-[15px] leading-[1.5] text-text-secondary-light dark:text-text-secondary-dark">
                                Try another word, or show every topic.
                            </Text>
                        </View>
                    ) : nothingStarred ? (
                        <View className="items-center px-8 pt-16">
                            <Text
                                className="text-center text-[22px] text-text-light dark:text-text-dark"
                                style={{ fontFamily: 'PlayfairDisplayRegular' }}
                            >
                                No starred moments yet
                            </Text>
                            <Text className="mt-3 text-center text-[15px] leading-[1.5] text-text-secondary-light dark:text-text-secondary-dark">
                                Open an entry and tap the star to keep a moment here.
                            </Text>
                        </View>
                    ) : (
                        <HistoryEmpty
                            hasAnyItems={hasAnyItems}
                            isSearching={isSearching}
                            onWritePress={() => router.push('/chat')}
                        />
                    )
                ) : (
                    <View className="gap-6 pt-4">
                        {feedRows.map((row, index) => {
                            const content = row.kind === 'month' ? (
                                <HistoryMonthBreak label={row.label} />
                            ) : (
                                <HistorySection
                                    section={row.section}
                                    onPressItem={handlePressItem}
                                    starredIds={starredSet}
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
