import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FinishBackgroundBanner } from '@/components/entries/FinishBackgroundBanner';
import { MoodChipRow } from '@/components/entries/MoodChipRow';
import { TagChipRow } from '@/components/entries/TagChipRow';
import { SelectionBar } from '@/components/entries/SelectionBar';
import { BulkLabelSheet, type BulkLabelMode } from '@/components/entries/BulkLabelSheet';
import { sharedLabels } from '@/utils/bulkLabels';
import { WrittenDaysRow } from '@/components/entries/WrittenDaysRow';
import { ArchiveEmptyState } from '@/components/entries/ArchiveEmptyState';
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
import { formatWeekMeta, HistoryItem } from '@/hooks/history/historyUtils';
import { useHistoryFeed } from '@/hooks/history/useHistoryFeed';
import { useStarredEntries } from '@/hooks/journal/useStarredEntries';
import { useEntryTags } from '@/hooks/journal/useEntryTags';
import { useArchiveFilters } from '@/hooks/journal/useArchiveFilters';
import { buildFeedRows } from '@/utils/writtenDays';
import { countMoodItems, normalizeMood } from '@/utils/moodChips';
import { countTopicItems, normalizeTopic } from '@/utils/topicChips';
import { useTabNavigation } from '@/hooks/navigation/useTabNavigation';
import { countTagItems, formatTagLabel } from '@/utils/entryTags';
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
    } = useHistoryFeed();
    const { goToTab } = useTabNavigation();

    // The feed is every entry ever written, not this week - the header says so.
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
    const [activeMood, setActiveMood] = useState('');
    const [activeDay, setActiveDay] = useState('');
    const [activeTag, setActiveTag] = useState('');
    const [picking, setPicking] = useState(false);
    const [picked, setPicked] = useState<string[]>([]);
    const [labelSheetOpen, setLabelSheetOpen] = useState(false);
    const [bulkMode, setBulkMode] = useState<BulkLabelMode>('add');
    const { starredIds, starredSet } = useStarredEntries();
    const { tagsByEntry, renameTag, deleteTag, addTagMany, removeTagMany } = useEntryTags();

    // The feed stays fresh through the storage change bus (Kaneo #87): a
    // finished entry, a restored backup or a demo seed row notifies the two
    // collection hooks directly. Only the small draft banner still needs a
    // focus check, so a tab press no longer parses the entire journal.
    useFocusEffect(
        useCallback(() => {
            let isActive = true;
            getMostRecentActiveSession().then((session) => {
                if (isActive) setActiveSession(session);
            });
            return () => {
                isActive = false;
            };
        }, [])
    );

    const showBanner = activeSession !== null
        && activeSession.conversationId !== dismissedId;

    const {
        beforeTopicSections,
        afterTopicSections,
        topicChips,
        moodChips,
        tagChips,
        resolvedTag,
        writtenDayChips,
        resolvedDay,
        visibleSections,
    } = useArchiveFilters({
        searchSections, starredSet, tagsByEntry,
        query, showStarredOnly, activeTopic, activeTag, activeMood, activeDay,
    });

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
        // Picking toggles a journal row; check-ins keep opening (labels belong to entries).
        if (picking && item.type === 'journal') {
            setPicked((prev) => (prev.includes(item.sourceId)
                ? prev.filter((id) => id !== item.sourceId)
                : [...prev, item.sourceId]));
            return;
        }
        if (item.type === 'journal') {
            router.push({ pathname: '/entry-detail', params: { id: item.sourceId } });
            return;
        }
        if (item.intentionId) {
            router.push({ pathname: '/intentions/detail', params: { id: item.intentionId } });
            return;
        }
        router.push({ pathname: '/checkin-detail', params: { id: item.sourceId } });
    }, [picking, router]);

    const pickedSet = useMemo(() => new Set(picked), [picked]);
    // Only labels the whole selection shares can be taken off (sharedLabels).
    const shared = useMemo(() => sharedLabels(picked, tagsByEntry), [picked, tagsByEntry]);
    const openBulkSheet = (mode: BulkLabelMode) => { setBulkMode(mode); setLabelSheetOpen(true); };
    const hasAnyItems = sections.length > 0;
    const isSearching = query.trim().length > 0;
    const isEmpty = !isLoading && visibleSections.length === 0;
    const nothingStarred = showStarredOnly && starredIds.length === 0;
    const noTopicMatches = normalizeTopic(activeTopic).length > 0
        && countTopicItems(beforeTopicSections, activeTopic) === 0;
    const activeTopicLabel = topicChips.find((chip) => chip.label === activeTopic)?.label
        ?? normalizeTopic(activeTopic);
    const noMoodMatches = normalizeMood(activeMood).length > 0
        && countMoodItems(afterTopicSections, activeMood) === 0;
    const activeMoodLabel = moodChips.find((chip) => chip.label === activeMood)?.label
        ?? normalizeMood(activeMood);
    const countMoodFor = (label: string) => countMoodItems(afterTopicSections, label);
    // Count from the chips' feed, not the narrowed one, or others read 0.
    const countTagFor = (label: string) => countTagItems(afterTopicSections, label, tagsByEntry);
    const selectedDay = visibleSections.length > 0
        ? visibleSections[0]
        : afterTopicSections.find((section) => section.dateKey === resolvedDay);
    const noDayMatches = resolvedDay.length > 0 && visibleSections.length === 0;
    const noTagMatches = resolvedTag.length > 0
        && countTagItems(afterTopicSections, resolvedTag, tagsByEntry) === 0;
    const activeTagLabel = formatTagLabel(resolvedTag);

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
                    <Pressable
                        onPress={() => {
                            setPicking((value) => !value);
                            setPicked([]);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={picking ? 'Stop picking entries' : 'Pick several entries'}
                        accessibilityState={{ selected: picking }}
                        testID="archive-pick-toggle"
                        className="min-h-11 justify-center rounded-control border border-hairline-light px-3 dark:border-hairline-dark"
                    >
                        <Text className="text-[14px] text-text-secondary-light dark:text-text-secondary-dark">
                            {picking ? 'Cancel' : 'Pick'}
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

            <MoodChipRow
                chips={moodChips}
                activeMood={activeMood}
                countFor={countMoodFor}
                onSelect={setActiveMood}
            />

            <TagChipRow
                chips={tagChips}
                activeTag={resolvedTag}
                countFor={countTagFor}
                onSelect={setActiveTag}
                onRename={(from, to) => { void renameTag(from, to); setActiveTag(to); }}
                onDelete={(label) => { void deleteTag(label); setActiveTag(''); }}
            />

            <WrittenDaysRow
                chips={writtenDayChips}
                activeDay={resolvedDay}
                onSelect={setActiveDay}
            />

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
                    <ArchiveEmptyState
                        noTagMatches={noTagMatches}
                        activeTagLabel={activeTagLabel}
                        noDayMatches={noDayMatches}
                        selectedDay={selectedDay}
                        onClearDay={() => setActiveDay('')}
                        noMoodMatches={noMoodMatches}
                        activeMoodLabel={activeMoodLabel}
                        noTopicMatches={noTopicMatches}
                        activeTopicLabel={activeTopicLabel}
                        nothingStarred={nothingStarred}
                        hasAnyItems={hasAnyItems}
                        isSearching={isSearching}
                        onWritePress={() => router.push('/chat')}
                    />
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
                                    selectedIds={picking ? pickedSet : undefined}
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

            {picking ? (
                <SelectionBar
                    count={picked.length}
                    onLabel={() => openBulkSheet('add')}
                    onRemoveLabel={shared.length > 0 ? () => openBulkSheet('remove') : undefined}
                    noSharedLabel={picked.length > 1 && shared.length === 0}
                    onDone={() => {
                        setPicking(false);
                        setPicked([]);
                    }}
                />
            ) : null}

            <BulkLabelSheet
                visible={labelSheetOpen}
                count={picked.length}
                mode={bulkMode}
                sharedLabels={shared}
                onCancel={() => setLabelSheetOpen(false)}
                onSubmit={(label) => {
                    void (bulkMode === 'add' ? addTagMany(picked, label) : removeTagMany(picked, label));
                    setLabelSheetOpen(false);
                    setPicking(false);
                    setPicked([]);
                }}
            />

            <BottomNav
                activeTab="entries"
                onTabPress={handleTabPress}
                onFabPress={() => router.push('/chat')}
            />
        </ScreenContainer>
    );
}
