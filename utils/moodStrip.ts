import { getLocalDateKeyFromTimestamp } from '@/utils/date';

/** Only the fields the strip needs; HistoryItem satisfies this. */
export interface MoodSource {
    id: string;
    mood?: string;
    createdAt: number;
}

export interface MoodDayCell {
    dateKey: string;
    /** Plain mood word for the day, or null when nothing was written. */
    mood: string | null;
    /** True when at least one entry/check-in was saved that day. */
    hasWriting: boolean;
    entryCount: number;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu;

/** Keep the word, drop the picture: moods are stored as "Calm 😌". */
export function plainMoodWord(raw: string | undefined): string | null {
    if (typeof raw !== 'string') return null;
    const cleaned = raw.replace(EMOJI, '').replace(/\s+/g, ' ').trim();
    return cleaned.length > 0 ? cleaned : null;
}

function dateKeyFor(timestamp: number): string {
    return getLocalDateKeyFromTimestamp(timestamp);
}

/**
 * Seven day cells for the week ending today, oldest first.
 *
 * Pure and offline: it walks the items the screen already loaded, keeps one
 * cell per calendar day, and takes the latest written mood of that day. A day
 * with no writing stays empty (null) rather than borrowing a neighbouring
 * mood — not writing is not the same as feeling bad.
 */
export function buildWeekMoodStrip(
    items: readonly MoodSource[],
    now: Date | number = new Date(),
): MoodDayCell[] {
    const nowTs = now instanceof Date ? now.getTime() : now;
    const cells: MoodDayCell[] = [];
    const byKey = new Map<string, MoodDayCell>();

    for (let offset = 6; offset >= 0; offset -= 1) {
        const at = new Date(nowTs);
        at.setDate(at.getDate() - offset);
        const cell: MoodDayCell = {
            dateKey: dateKeyFor(at.getTime()),
            mood: null,
            hasWriting: false,
            entryCount: 0,
        };
        cells.push(cell);
        byKey.set(cell.dateKey, cell);
    }

    const latestAt = new Map<string, number>();
    for (const item of items) {
        if (!item || typeof item.createdAt !== 'number') continue;
        const key = dateKeyFor(item.createdAt);
        const cell = byKey.get(key);
        if (!cell) continue;
        cell.hasWriting = true;
        cell.entryCount += 1;
        const word = plainMoodWord(item.mood);
        if (!word) continue;
        const previous = latestAt.get(key) ?? Number.NEGATIVE_INFINITY;
        if (item.createdAt >= previous) {
            latestAt.set(key, item.createdAt);
            cell.mood = word;
        }
    }

    return cells;
}

/** "Today", "Yesterday", or the weekday name — never a raw date. */
export function formatMoodDayLabel(cell: MoodDayCell, strip: readonly MoodDayCell[]): string {
    const index = strip.findIndex((entry) => entry.dateKey === cell.dateKey);
    if (index === strip.length - 1) return 'Today';
    if (index === strip.length - 2) return 'Yesterday';
    const [year, month, dayOfMonth] = cell.dateKey.split('-').map(Number);
    const date = new Date(year, (month ?? 1) - 1, dayOfMonth ?? 1);
    return DAY_NAMES[date.getDay()];
}
