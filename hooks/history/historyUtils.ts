import { JournalEntry } from '@/services/journal/journalStorage.types';
import { IntentionCheckIn } from '@/services/intentions/intentionsStorage.types';
import { getLocalDateKey } from '@/utils/date';

export type HistoryItemType = 'journal' | 'checkin';
export type HistoryFilter = 'all' | 'journal' | 'ritual';

export interface HistoryItem {
    id: string;
    type: HistoryItemType;
    title: string;
    summary: string;
    mood?: string;
    createdAt: number;
    sourceId: string;
    checkInType?: IntentionCheckIn['type'];
    intentionId?: string;
}

export interface HistorySection {
    dateKey: string;
    label: string;
    dayNumber: number;
    weekdayShort: string;
    relativeLabel: 'today' | 'yesterday' | null;
    monthKey: string;
    monthLabel: string;
    items: HistoryItem[];
}

export interface WeeklyHistorySummary {
    label: string;
    itemCount: number;
    journalCount: number;
    checkInCount: number;
    activeDays: number;
    activeDayKeys: string[];
    weekDayKeys: string[];
    topSignals: string[];
}

export interface HistoryDayMeta {
    dateKey: string;
    dayNumber: number;
    weekdayShort: string;
    relativeLabel: 'today' | 'yesterday' | null;
    monthKey: string;
    monthLabel: string;
    label: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];
const SIGNAL_STOP_WORDS = new Set([
    'about',
    'available',
    'check',
    'entry',
    'feeling',
    'intention',
    'journal',
    'morning',
    'reflection',
    'summary',
]);

export function toDateKey(timestamp: number): string {
    return getLocalDateKey(new Date(timestamp));
}

export function parseDateKey(dateKey: string): Date {
    const [year, month, day] = dateKey.split('-').map((value) => Number(value));
    return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function formatMonthYear(date = new Date()): string {
    return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

export function getWeekdayMonograms(): readonly string[] {
    return DAY_SHORT;
}

function startOfDay(date: Date): Date {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
}

export function resolveDayMeta(date: Date, now = new Date()): HistoryDayMeta {
    const compare = startOfDay(date);
    const today = startOfDay(now);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let relativeLabel: HistoryDayMeta['relativeLabel'] = null;
    if (compare.getTime() === today.getTime()) {
        relativeLabel = 'today';
    } else if (compare.getTime() === yesterday.getTime()) {
        relativeLabel = 'yesterday';
    }

    const dayNumber = compare.getDate();
    const weekdayShort = DAY_NAMES[compare.getDay()].slice(0, 3);
    const monthKey = `${compare.getFullYear()}-${String(compare.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = MONTH_NAMES[compare.getMonth()];
    const dateKey = getLocalDateKey(compare);

    const label = relativeLabel === 'today'
        ? 'Today'
        : relativeLabel === 'yesterday'
            ? 'Yesterday'
            : `${DAY_NAMES[compare.getDay()]} ${monthLabel} ${dayNumber}`;

    return {
        dateKey,
        dayNumber,
        weekdayShort,
        relativeLabel,
        monthKey,
        monthLabel,
        label,
    };
}

/** @deprecated Prefer resolveDayMeta — kept for callers expecting a single string label. */
export function formatDateLabel(date: Date): string {
    return resolveDayMeta(date).label;
}

function extractSummaryFromEntry(entry: JournalEntry): string {
    const message = entry.messages.find((m) => m.role === 'user');
    if (!message) {
        return 'No summary available.';
    }

    const text = message.content.trim();
    return text.length > 140 ? `${text.slice(0, 140).trim()}...` : text;
}

export function buildHistoryItems(
    entries: JournalEntry[],
    checkIns: IntentionCheckIn[]
): HistoryItem[] {
    const journalItems = entries.map<HistoryItem>((entry) => {
        const mood = entry.analysis?.mood?.trim();
        return {
            id: `journal-${entry.id}`,
            type: 'journal',
            title: entry.title,
            summary: extractSummaryFromEntry(entry),
            mood: mood || undefined,
            createdAt: entry.createdAt,
            sourceId: entry.id,
        };
    });

    const checkInItems = checkIns.map<HistoryItem>((checkIn) => ({
        id: `checkin-${checkIn.id}`,
        type: 'checkin',
        title: checkIn.title,
        summary: checkIn.summary,
        mood: checkIn.mood?.trim() || undefined,
        createdAt: checkIn.createdAt,
        sourceId: checkIn.id,
        checkInType: checkIn.type,
        intentionId: checkIn.intentionId,
    }));

    return [...journalItems, ...checkInItems].sort((a, b) => b.createdAt - a.createdAt);
}

export function filterHistoryItems(
    items: readonly HistoryItem[],
    filter: HistoryFilter
): HistoryItem[] {
    if (filter === 'all') return [...items];
    if (filter === 'journal') return items.filter((item) => item.type === 'journal');
    return items.filter((item) => item.type === 'checkin');
}

export function filterHistorySections(
    sections: readonly HistorySection[],
    filter: HistoryFilter
): HistorySection[] {
    if (filter === 'all') return [...sections];
    return sections
        .map((section) => ({
            ...section,
            items: filterHistoryItems(section.items, filter),
        }))
        .filter((section) => section.items.length > 0);
}

function getWeekBounds(date: Date): { start: Date; end: Date } {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
}

export function buildWeekDayKeys(now = new Date()): string[] {
    const { start } = getWeekBounds(now);
    return Array.from({ length: 7 }, (_, index) => {
        const day = new Date(start);
        day.setDate(start.getDate() + index);
        return getLocalDateKey(day);
    });
}

function formatShortDate(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function tokenizeSignalText(text: string): string[] {
    return text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 4 && !SIGNAL_STOP_WORDS.has(token));
}

function getTopSignals(items: readonly HistoryItem[]): string[] {
    const counts = new Map<string, number>();
    items.flatMap((item) => tokenizeSignalText(`${item.title} ${item.summary}`))
        .forEach((token) => counts.set(token, (counts.get(token) ?? 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
        .slice(0, 3).map(([token]) => token);
}

export function buildWeeklyHistorySummary(
    items: readonly HistoryItem[],
    now = new Date()
): WeeklyHistorySummary {
    const { start, end } = getWeekBounds(now);
    const weekItems = items.filter((item) => item.createdAt >= start.getTime()
        && item.createdAt < end.getTime());
    const activeDayKeySet = new Set(weekItems.map((item) => toDateKey(item.createdAt)));
    const activeDayKeys = Array.from(activeDayKeySet).sort();
    const endLabel = new Date(end);
    endLabel.setDate(endLabel.getDate() - 1);

    return {
        label: `${formatShortDate(start)} - ${formatShortDate(endLabel)}`,
        itemCount: weekItems.length,
        journalCount: weekItems.filter((item) => item.type === 'journal').length,
        checkInCount: weekItems.filter((item) => item.type === 'checkin').length,
        activeDays: activeDayKeys.length,
        activeDayKeys,
        weekDayKeys: buildWeekDayKeys(now),
        topSignals: getTopSignals(weekItems),
    };
}

export function formatWeekProse(summary: WeeklyHistorySummary): string | null {
    if (summary.itemCount === 0) return null;
    const entryWord = summary.itemCount === 1 ? 'entry' : 'entries';
    const dayWord = summary.activeDays === 1 ? 'day' : 'days';
    return `${summary.itemCount} ${entryWord} · ${summary.activeDays} ${dayWord}`;
}

export function groupHistorySections(
    items: HistoryItem[],
    now = new Date()
): HistorySection[] {
    const groups = new Map<string, HistoryItem[]>();

    items.forEach((item) => {
        const key = toDateKey(item.createdAt);
        const list = groups.get(key) ?? [];
        list.push(item);
        groups.set(key, list);
    });

    return Array.from(groups.entries())
        .sort(([a], [b]) => (a > b ? -1 : 1))
        .map(([dateKey, groupItems]) => {
            const meta = resolveDayMeta(parseDateKey(dateKey), now);
            return {
                dateKey,
                label: meta.label,
                dayNumber: meta.dayNumber,
                weekdayShort: meta.weekdayShort,
                relativeLabel: meta.relativeLabel,
                monthKey: meta.monthKey,
                monthLabel: meta.monthLabel,
                items: groupItems.sort((a, b) => b.createdAt - a.createdAt),
            };
        });
}
