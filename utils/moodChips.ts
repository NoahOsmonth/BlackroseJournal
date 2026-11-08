/**
 * Pure mood-chip helpers for the Archive. No I/O, no hooks, no clock read
 * (AGENTS.md rule 3). Chips come from the feed's already loaded items, so
 * filtering by feeling adds ZERO storage reads.
 *
 * 2026 research: MindJrnl's 'The Best Journaling App in 2026' asks 'Can you
 * filter by date, mood, or tag?'. Round 39 shipped tag/topic chips; this is
 * the mood half of the same checklist item.
 */
import type { HistoryItem, HistorySection } from '@/hooks/history/historyUtils';
import { plainMoodWord } from '@/utils/moodStrip';

export interface MoodChip {
    readonly label: string;
    /** DISTINCT entries with this mood, not mentions inside one entry. */
    readonly count: number;
}

export const MOOD_CHIP_LIMIT = 6;

/**
 * One canonical key per feeling. Reuses the app's existing mood normalizer
 * so 'Calm 😌', 'calm' and ' Calm ' all become ONE chip.
 */
export function normalizeMood(value: string): string {
    return (plainMoodWord(value) ?? '').toLowerCase();
}

export function moodWordForItem(item: HistoryItem): string | null {
    return plainMoodWord(item.mood);
}

export function moodMatchesItem(item: HistoryItem, mood: string): boolean {
    const key = normalizeMood(mood);
    const word = moodWordForItem(item);
    return key.length > 0 && word !== null && word.toLowerCase() === key;
}

/**
 * Rank moods across ALL sections by DISTINCT item count. Ties break
 * alphabetically so the row never jitters between renders. Items with no
 * mood are skipped — "no mood recorded" is not a feeling to browse.
 */
export function collectMoodChips(
    sections: readonly HistorySection[],
    limit: number = MOOD_CHIP_LIMIT,
): MoodChip[] {
    const counts = new Map<string, number>();
    const labels = new Map<string, string>();
    sections.forEach((section) => {
        section.items.forEach((item) => {
            const word = moodWordForItem(item);
            if (!word) return;
            const key = word.toLowerCase();
            counts.set(key, (counts.get(key) ?? 0) + 1);
            if (!labels.has(key)) labels.set(key, word);
        });
    });
    const ranked = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : MOOD_CHIP_LIMIT;
    return ranked.slice(0, safeLimit).map(([key, count]) => ({
        label: labels.get(key) ?? key,
        count,
    }));
}

/**
 * Keep only items with this feeling. Sections with no matches disappear
 * entirely rather than leaving a bare date heading behind.
 */
export function filterSectionsByMood(
    sections: readonly HistorySection[],
    mood: string,
): HistorySection[] {
    if (normalizeMood(mood).length === 0) return sections.map((section) => ({ ...section }));
    const result: HistorySection[] = [];
    sections.forEach((section) => {
        const items = section.items.filter((item) => moodMatchesItem(item, mood));
        if (items.length > 0) result.push({ ...section, items });
    });
    return result;
}

/** Honest recount against the CURRENT narrowed feed. */
export function countMoodItems(sections: readonly HistorySection[], mood: string): number {
    return filterSectionsByMood(sections, mood).reduce(
        (total, section) => total + section.items.length,
        0,
    );
}
