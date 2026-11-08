/**
 * Pure Archive filtering for starred moments. No I/O, no hooks — utils/ stays
 * pure (AGENTS.md rule 3). Kept separate from the storage service so the
 * filtering rule is testable without a renderer or an account context.
 */
import type { HistorySection } from '@/hooks/history/historyUtils';

/**
 * Keep only sections that still contain at least one starred item. Empty days
 * disappear entirely rather than leaving a bare date heading behind.
 *
 * Only journal entries can be starred; check-ins have no star control, so they
 * are dropped from the starred view. An unrecognised id never matches.
 *
 * IMPORTANT: a HistoryItem.id is a *display* key (`journal-<entryId>`), while
 * the star store keeps the raw entry id. Match on `sourceId`, not `id` —
 * comparing to `id` silently shows "1 shown" with an empty list.
 */
export function filterStarredSections(
    sections: readonly HistorySection[],
    starredIds: ReadonlySet<string>,
): HistorySection[] {
    if (starredIds.size === 0) return [];
    const result: HistorySection[] = [];
    for (const section of sections) {
        const items = section.items.filter(
            (item) => item.type === 'journal' && starredIds.has(item.sourceId),
        );
        if (items.length > 0) result.push({ ...section, items });
    }
    return result;
}
