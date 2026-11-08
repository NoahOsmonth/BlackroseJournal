/**
 * Feeds the pure year-grid builder from the journal collections the app has
 * already loaded. No new storage reads: useJournalEntries /
 * useIntentionCheckIns already hold the rows (R2 in ui-performance-rules.md).
 */
import { useMemo } from 'react';

import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import { buildEntryText } from '@/utils/entryText';
import { groupWritingByDay, type DayWritingItem } from '@/utils/writingDay';
import { buildWritingYearGrid, type WritingYearGrid } from '@/utils/writingYear';

/** Count words in a body without allocating a joined array of all entries. */
function countWords(text: string): number {
    const trimmed = text.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** One row in the day list: enough to show a preview and open the original. */
export interface WritingDayRow {
    readonly id: string;
    readonly title: string;
    readonly preview: string;
    readonly kind: 'entry' | 'checkin';
    readonly createdAt: number;
    readonly words: number;
}

export interface UseWritingYearReturn {
    readonly grid: WritingYearGrid;
    readonly daysByKey: ReadonlyMap<string, { readonly items: readonly WritingDayRow[]; readonly totalWords: number }>;
    readonly isLoading: boolean;
}

export function useWritingYear(): UseWritingYearReturn {
    const { completed: entries, isLoading: entriesLoading } = useJournalEntries();
    const { completed: checkIns, isLoading: checkInsLoading } = useIntentionCheckIns();

    const { grid, daysByKey } = useMemo(() => {
        const rows: DayWritingItem<WritingDayRow>[] = [];

        entries.forEach((entry) => {
            const text = buildEntryText(entry.messages);
            rows.push({
                id: entry.id,
                createdAt: entry.createdAt,
                words: countWords(text),
                title: entry.title || 'A journal moment',
                value: {
                    id: entry.id,
                    title: entry.title || 'A journal moment',
                    preview: text.trim().slice(0, 140),
                    kind: 'entry',
                    createdAt: entry.createdAt,
                    words: countWords(text),
                },
            });
        });

        checkIns.forEach((checkIn) => {
            const text = [checkIn.title, checkIn.summary].filter(Boolean).join(' ');
            rows.push({
                id: checkIn.id,
                createdAt: checkIn.createdAt,
                words: countWords(text),
                title: checkIn.title || 'A check-in',
                value: {
                    id: checkIn.id,
                    title: checkIn.title || 'A check-in',
                    preview: checkIn.summary.trim().slice(0, 140),
                    kind: 'checkin',
                    createdAt: checkIn.createdAt,
                    words: countWords(text),
                },
            });
        });

        const grouped = groupWritingByDay(rows);
        const words = new Map<string, number>();
        const days = new Map<string, { items: readonly WritingDayRow[]; totalWords: number }>();
        for (const [dateKey, day] of grouped) {
            words.set(dateKey, day.totalWords);
            days.set(dateKey, { items: day.items.map((item) => item.value), totalWords: day.totalWords });
        }
        return { grid: buildWritingYearGrid(words, new Date()), daysByKey: days };
    }, [entries, checkIns]);

    return { grid, daysByKey, isLoading: entriesLoading || checkInsLoading };
}
