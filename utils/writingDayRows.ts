/**
 * One shape for "what did I write on this day?"
 *
 * Pure: no I/O, no hooks, no clock read. Both the year grid and the month
 * calendar build their day lists from this, so a new title fallback or word
 * rule cannot drift between two screens. Uses the real stored row types so a
 * test fixture cannot flatten a distinction that production keeps.
 */
import type { JournalEntry } from '@/services/journal/journalStorage.types';
import type { IntentionCheckIn } from '@/services/intentions/intentionsStorage.types';
import { buildEntryText } from '@/utils/entryText';
import { groupWritingByDay, type DayWriting, type DayWritingItem } from '@/utils/writingDay';

/** One row in the day list: enough to show a preview and open the original. */
export interface WritingDayRow {
    readonly id: string;
    readonly title: string;
    readonly preview: string;
    readonly kind: 'entry' | 'checkin';
    readonly createdAt: number;
    readonly words: number;
}

export interface WritingDayGroup {
    readonly items: readonly WritingDayRow[];
    readonly totalWords: number;
}

/** Count words in a body without allocating a joined array of all entries. */
export function countWritingWords(text: string): number {
    const trimmed = text.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Flatten the two already-loaded collections into date-grouped day rows. */
export function buildWritingDayRows(
    entries: readonly JournalEntry[],
    checkIns: readonly IntentionCheckIn[],
): ReadonlyMap<string, WritingDayGroup> {
    const rows: DayWritingItem<WritingDayRow>[] = [];

    entries.forEach((entry) => {
        const text = buildEntryText(entry.messages);
        const title = entry.title || 'A journal moment';
        const words = countWritingWords(text);
        rows.push({
            id: entry.id,
            createdAt: entry.createdAt,
            words,
            title,
            value: {
                id: entry.id,
                title,
                preview: text.trim().slice(0, 140),
                kind: 'entry',
                createdAt: entry.createdAt,
                words,
            },
        });
    });

    checkIns.forEach((checkIn) => {
        const text = [checkIn.title, checkIn.summary].filter(Boolean).join(' ');
        const title = checkIn.title || 'A check-in';
        const words = countWritingWords(text);
        rows.push({
            id: checkIn.id,
            createdAt: checkIn.createdAt,
            words,
            title,
            value: {
                id: checkIn.id,
                title,
                preview: checkIn.summary.trim().slice(0, 140),
                kind: 'checkin',
                createdAt: checkIn.createdAt,
                words,
            },
        });
    });

    const grouped = groupWritingByDay(rows);
    const result = new Map<string, WritingDayGroup>();
    for (const [dateKey, day] of grouped as ReadonlyMap<string, DayWriting<WritingDayRow>>) {
        result.set(dateKey, {
            items: day.items.map((item) => item.value),
            totalWords: day.totalWords,
        });
    }
    return result;
}

export type { WritingDayRow as MonthDayRow };
