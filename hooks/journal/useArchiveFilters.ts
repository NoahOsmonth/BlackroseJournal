import { useMemo } from 'react';

import type { HistorySection as HistorySectionModel } from '@/hooks/history/historyUtils';
import { filterStarredSections } from '@/utils/starredSections';
import { buildWrittenDayChips, filterSectionsByDay, resolveActiveDay } from '@/utils/writtenDays';
import { collectMoodChips, filterSectionsByMood } from '@/utils/moodChips';
import { collectTopicChips, filterSectionsByTopic } from '@/utils/topicChips';
import { collectTagChips, filterSectionsByTag, resolveActiveTag } from '@/utils/entryTags';

export interface ArchiveFilterInput {
    /** Bound corpus search from the feed hook. */
    searchSections: (query: string) => HistorySectionModel[];
    starredSet: ReadonlySet<string>;
    tagsByEntry: Readonly<Record<string, readonly string[]>>;
    query: string;
    showStarredOnly: boolean;
    activeTopic: string;
    activeTag: string;
    activeMood: string;
    activeDay: string;
}

/**
 * The Archive's narrowing chain, in one place: search -> starred -> topic ->
 * label -> mood -> day. Each row of chips is derived from the feed *after* the
 * choices above it, so a chip's number always says how many entries are really
 * behind it, and a strip never offers a value that the choices already hid.
 *
 * Order is behaviour, not style: moving a step changes every count downstream,
 * which is why it lives here (with tests) instead of inline in the screen.
 */
export function useArchiveFilters(input: ArchiveFilterInput) {
    const {
        searchSections,
        starredSet,
        tagsByEntry,
        query,
        showStarredOnly,
        activeTopic,
        activeTag,
        activeMood,
        activeDay,
    } = input;

    const filteredSections = useMemo(
        () => searchSections(query),
        [searchSections, query]
    );

    const beforeTopicSections = useMemo(
        () => (showStarredOnly
            ? filterStarredSections(filteredSections, starredSet)
            : filteredSections),
        [showStarredOnly, filteredSections, starredSet]
    );

    const topicChips = useMemo(
        () => collectTopicChips(beforeTopicSections),
        [beforeTopicSections]
    );

    const afterTopicSections = useMemo(
        () => (activeTopic
            ? filterSectionsByTopic(beforeTopicSections, activeTopic)
            : beforeTopicSections),
        [activeTopic, beforeTopicSections]
    );

    const moodChips = useMemo(
        () => collectMoodChips(afterTopicSections),
        [afterTopicSections]
    );

    // Labels narrow after topic, so each label count is honest.
    const tagChips = useMemo(
        () => collectTagChips(afterTopicSections, tagsByEntry),
        [afterTopicSections, tagsByEntry]
    );
    const resolvedTag = resolveActiveTag(tagChips, activeTag);
    const afterTagSections = useMemo(
        () => filterSectionsByTag(afterTopicSections, resolvedTag, tagsByEntry),
        [afterTopicSections, resolvedTag, tagsByEntry]
    );

    // Days come from the feed after every other choice, so the strip never
    // offers a day whose writing those choices just hid.
    const writtenDayChips = useMemo(
        () => buildWrittenDayChips(afterTagSections),
        [afterTagSections]
    );
    const resolvedDay = resolveActiveDay(writtenDayChips, activeDay);

    const visibleSections = useMemo(() => {
        const byMood = activeMood
            ? filterSectionsByMood(afterTagSections, activeMood)
            : afterTagSections;
        return filterSectionsByDay(byMood, resolvedDay);
    }, [activeMood, afterTagSections, resolvedDay]);

    return {
        filteredSections,
        beforeTopicSections,
        afterTopicSections,
        afterTagSections,
        topicChips,
        moodChips,
        tagChips,
        resolvedTag,
        writtenDayChips,
        resolvedDay,
        visibleSections,
    };
}
