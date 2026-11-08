/**
 * Recurring themes across weeks (Kaneo #25).
 *
 * A weekly rollup already lists the topics that came up. One week mentioning
 * something means nothing; the same thing coming back across several weeks is a
 * pattern, and that is the thing a journal cannot show you by scrolling.
 *
 * Pure — takes rollups, returns patterns. No I/O.
 */

import type { MemoryRollup } from '@/services/memory/memoryRollup.types';

export interface RecurringTheme {
    /** Lowercase tag as stored, e.g. 'work stress'. */
    readonly topic: string;
    /** Week keys it appeared in, oldest first, e.g. ['2026-W40', '2026-W44']. */
    readonly weeks: string[];
    /** How many distinct weeks mentioned it. */
    readonly weekCount: number;
    /** Most recent week key it appeared in. */
    readonly lastWeek: string;
}

/**
 * A pattern needs at least this many distinct weeks. Two weeks in a row can be
 * a coincidence; three months of the same word is a theme.
 */
export const MIN_WEEKS_FOR_PATTERN = 3;

/** How look-back list to show. Beyond six, it stops reading like a pattern. */
export const MAX_PATTERNS = 6;

function normaliseTopic(topic: string): string {
    return topic.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Find the topics that keep coming back.
 *
 * Only weekly rollups are considered: a month rollup covers the same days, so
 * counting both would double-count a topic and make it look more frequent than
 * it is. Ordered by how many weeks mentioned the topic, then by how recently.
 */
export function findRecurringThemes(
    rollups: readonly MemoryRollup[],
    minWeeks = MIN_WEEKS_FOR_PATTERN,
): RecurringTheme[] {
    const byTopic = new Map<string, Set<string>>();

    for (const rollup of rollups) {
        if (rollup.kind !== 'week') continue;
        for (const raw of rollup.topics) {
            const topic = normaliseTopic(raw);
            if (topic.length === 0) continue;
            const weeks = byTopic.get(topic) ?? new Set<string>();
            weeks.add(rollup.periodKey);
            byTopic.set(topic, weeks);
        }
    }

    const themes: RecurringTheme[] = [];
    for (const [topic, weeks] of byTopic) {
        if (weeks.size < minWeeks) continue;
        const sorted = [...weeks].sort();
        themes.push({
            topic,
            weeks: sorted,
            weekCount: sorted.length,
            lastWeek: sorted[sorted.length - 1],
        });
    }

    themes.sort((a, b) => {
        if (b.weekCount !== a.weekCount) return b.weekCount - a.weekCount;
        if (a.lastWeek !== b.lastWeek) return a.lastWeek < b.lastWeek ? 1 : -1;
        return a.topic.localeCompare(b.topic);
    });

    return themes.slice(0, MAX_PATTERNS);
}

/**
 * '3 weeks' / '5 weeks' — the plain count shown next to a pattern.
 */
export function describeWeekCount(count: number): string {
    return count === 1 ? '1 week' : `${count} weeks`;
}

export function hasEnoughRollupsForPatterns(rollups: readonly MemoryRollup[]): boolean {
    return rollups.filter((rollup) => rollup.kind === 'week').length >= MIN_WEEKS_FOR_PATTERN;
}
