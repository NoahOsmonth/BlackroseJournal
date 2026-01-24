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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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
