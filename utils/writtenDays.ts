/**
 * Browse the Archive by the days that actually have writing.
 *
 * Pure: no I/O, no hooks, no clock read. The caller passes the sections the
 * feed has already loaded and already narrowed. Chips are therefore honest:
 * a day only appears when there is something behind it right now.
 */
import { isValidIsoDateKey } from './date';
import type { HistorySection } from '@/hooks/history/historyUtils';

export interface WrittenDayChip {
    readonly dateKey: string;
    readonly label: string;
    readonly shortLabel: string;
    readonly itemCount: number;
}

const MONTH_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

function shortLabelFor(section: HistorySection): string {
    if (section.relativeLabel === 'today') return 'Today';
    if (section.relativeLabel === 'yesterday') return 'Yesterday';
    const [year, month, day] = section.dateKey.split('-').map(Number);
    if (month >= 1 && month <= 12) return `${MONTH_SHORT[month - 1]} ${day}`;
    return String(year ?? section.dateKey);
}

/** A phrase for the empty state, e.g. "Nothing written on Mar 3, 2026". */
export function formatWrittenDay(section: HistorySection): string {
    if (section.relativeLabel === 'today') return 'today';
    if (section.relativeLabel === 'yesterday') return 'yesterday';
    const [year, month, day] = section.dateKey.split('-').map(Number);
    if (month >= 1 && month <= 12) {
        return `on ${MONTH_SHORT[month - 1]} ${day}, ${year}`;
    }
    return `on ${section.dateKey}`;
}

/**
 * Newest-first chips from the CURRENT narrowed feed. Duplicate day keys are
 * merged (item counts add) rather than offering two chips for one day.
 * Invalid keys are skipped so a corrupt row cannot produce a dead chip.
 */
export function buildWrittenDayChips(sections: readonly HistorySection[]): readonly WrittenDayChip[] {
    const byKey = new Map<string, { section: HistorySection; itemCount: number }>();
    for (const section of sections) {
        if (!isValidIsoDateKey(section.dateKey)) continue;
        const count = Array.isArray(section.items) ? section.items.length : 0;
        const existing = byKey.get(section.dateKey);
        if (existing) existing.itemCount += count;
        else byKey.set(section.dateKey, { section, itemCount: count });
    }
    return Array.from(byKey.values())
        .sort((a, b) => b.section.dateKey.localeCompare(a.section.dateKey))
        .map(({ section, itemCount }) => ({
            dateKey: section.dateKey,
            label: section.label,
            shortLabel: shortLabelFor(section),
            itemCount,
        }));
}

/** Only the sections written on one day. Used as a first-class filter layer. */
export function filterSectionsByDay(
    sections: readonly HistorySection[],
    dateKey: string,
): readonly HistorySection[] {
    const key = dateKey.trim();
    if (!key) return sections;
    return sections.filter((section) => section.dateKey === key);
}

/**
 * A selected day is only kept when it is still reachable in the narrowed feed.
 * Otherwise a search that hides that day would leave a stale selection and an
 * Archive that looks empty for no reason the writer can see.
 */
export function resolveActiveDay(
    chips: readonly WrittenDayChip[],
    selected: string,
): string {
    const key = selected.trim();
    if (!key) return '';
    return chips.some((chip) => chip.dateKey === key) ? key : '';
}

export type FeedRow =
    | { kind: 'month'; key: string; label: string }
    | { kind: 'section'; key: string; section: HistorySection };

/** Month breaks + day sections, in the feed's own order. */
export function buildFeedRows(sections: readonly HistorySection[]): FeedRow[] {
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
        rows.push({ kind: 'section', key: section.dateKey, section });
    });
    return rows;
}
