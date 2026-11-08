/**
 * Pure helpers for writer-chosen labels in the Archive (AGENTS.md rule 3).
 * No I/O, no hooks, no clock read. Chips come from the feed's already loaded
 * items plus the label map, so filtering adds ZERO storage reads.
 */
import type { HistoryItem, HistorySection } from '@/hooks/history/historyUtils';

export interface TagChip {
    readonly label: string;
    readonly count: number;
}

export const TAG_CHIP_LIMIT = 8;

/** One canonical key per label: '  Work ' and 'WORK' become 'work'. */
export function normalizeTag(value: string): string {
    return typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, ' ') : '';
}

/** A chip reads as a person's word, not a machine key. */
export function formatTagLabel(tag: string): string {
    const key = normalizeTag(tag);
    return key.length === 0 ? '' : key.charAt(0).toUpperCase() + key.slice(1);
}

function labelsForItem(item: HistoryItem, tagsByEntry: Readonly<Record<string, readonly string[]>>): readonly string[] {
    // Only journal entries carry writer-chosen labels; check-ins never do.
    if (item.type !== 'journal') return [];
    return tagsByEntry[item.sourceId] ?? [];
}

export function entryHasTag(
    item: HistoryItem,
    tag: string,
    tagsByEntry: Readonly<Record<string, readonly string[]>>,
): boolean {
    const key = normalizeTag(tag);
    return key.length > 0 && labelsForItem(item, tagsByEntry).includes(key);
}

export function filterSectionsByTag(
    sections: readonly HistorySection[],
    tag: string,
    tagsByEntry: Readonly<Record<string, readonly string[]>>,
): HistorySection[] {
    if (normalizeTag(tag).length === 0) return sections.map((section) => ({ ...section }));
    const result: HistorySection[] = [];
    sections.forEach((section) => {
        const items = section.items.filter((item) => entryHasTag(item, tag, tagsByEntry));
        if (items.length > 0) result.push({ ...section, items });
    });
    return result;
}

export function countTagItems(
    sections: readonly HistorySection[],
    tag: string,
    tagsByEntry: Readonly<Record<string, readonly string[]>>,
): number {
    return filterSectionsByTag(sections, tag, tagsByEntry).reduce(
        (total, section) => total + section.items.length,
        0,
    );
}

/** Rank labels across ALL sections by DISTINCT item count, then alphabetically. */
export function collectTagChips(
    sections: readonly HistorySection[],
    tagsByEntry: Readonly<Record<string, readonly string[]>>,
): readonly TagChip[] {
    const counts = new Map<string, number>();
    sections.forEach((section) => {
        section.items.forEach((item) => {
            const seen = new Set<string>();
            labelsForItem(item, tagsByEntry).forEach((tag) => {
                if (tag.length === 0 || seen.has(tag)) return;
                seen.add(tag);
                counts.set(tag, (counts.get(tag) ?? 0) + 1);
            });
        });
    });
    return [...counts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .slice(0, TAG_CHIP_LIMIT);
}

/** Drop a stale selection instead of leaving an Archive that looks empty. */
export function resolveActiveTag(chips: readonly TagChip[], activeTag: string): string {
    return chips.some((chip) => chip.label === activeTag) ? activeTag : '';
}
