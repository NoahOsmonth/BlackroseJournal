import { JournalEntry } from '@/services/journal/journalStorage.types';
import { IntentionCheckIn } from '@/services/intentions/intentionsStorage.types';
import { getLocalDateKey } from '@/utils/date';

export type HistoryItemType = 'journal' | 'checkin';

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
    items: HistoryItem[];
}

export interface WeeklyHistorySummary {
    label: string;
    itemCount: number;
    journalCount: number;
    checkInCount: number;
    activeDays: number;
    topSignals: string[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
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

function parseDateKey(dateKey: string): Date {
    const [year, month, day] = dateKey.split('-').map((value) => Number(value));
    return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function formatDateLabel(date: Date): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const compare = new Date(date);
    compare.setHours(0, 0, 0, 0);

    const dayName = DAY_NAMES[compare.getDay()];
    const monthName = MONTH_NAMES[compare.getMonth()];
    const dayNumber = compare.getDate();

    if (compare.getTime() === today.getTime()) {
        return `Today ${monthName} ${dayNumber}`;
    }

    return `${dayName} ${monthName} ${dayNumber}`;
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
    const journalItems = entries.map<HistoryItem>((entry) => ({
        id: `journal-${entry.id}`,
        type: 'journal',
        title: entry.title,
        summary: extractSummaryFromEntry(entry),
        createdAt: entry.createdAt,
        sourceId: entry.id,
    }));

    const checkInItems = checkIns.map<HistoryItem>((checkIn) => ({
        id: `checkin-${checkIn.id}`,
        type: 'checkin',
        title: checkIn.title,
        summary: checkIn.summary,
        mood: checkIn.mood,
        createdAt: checkIn.createdAt,
        sourceId: checkIn.id,
        checkInType: checkIn.type,
        intentionId: checkIn.intentionId,
    }));

    return [...journalItems, ...checkInItems].sort((a, b) => b.createdAt - a.createdAt);
}

function getWeekBounds(date: Date): { start: Date; end: Date } {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
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
    const activeDays = new Set(weekItems.map((item) => toDateKey(item.createdAt))).size;
    const endLabel = new Date(end);
    endLabel.setDate(endLabel.getDate() - 1);

    return {
        label: `${formatShortDate(start)} - ${formatShortDate(endLabel)}`,
        itemCount: weekItems.length,
        journalCount: weekItems.filter((item) => item.type === 'journal').length,
        checkInCount: weekItems.filter((item) => item.type === 'checkin').length,
        activeDays,
        topSignals: getTopSignals(weekItems),
    };
}

export function groupHistorySections(items: HistoryItem[]): HistorySection[] {
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
            const date = parseDateKey(dateKey);
            return {
                dateKey,
                label: formatDateLabel(date),
                items: groupItems.sort((a, b) => b.createdAt - a.createdAt),
            };
        });
}
