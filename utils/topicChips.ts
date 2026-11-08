/**
 * Pure topic-chip helpers for the Archive. No I/O, no hooks, no clock read
 * (AGENTS.md rule 3). Chips are derived in memory from the feed's already
 * loaded items, so browsing by topic adds ZERO storage reads.
 *
 * 2026 research: Glimmo checklist item 6 'Search, Tags, and Review Tools';
 * 2026 comparison articles call for auto-generated tags that 'require zero
 * effort from you but still make entries findable'. This is the zero-effort
 * part: the writer never has to add a label.
 */
import type { HistoryItem, HistorySection } from '@/hooks/history/historyUtils';

export interface TopicChip {
    readonly label: string;
    /** DISTINCT entries containing this word, not mentions inside one entry. */
    readonly count: number;
}

/** Top chips shown in the row. The full ranked list stays available for tests. */
export const TOPIC_CHIP_LIMIT = 8;

/**
 * Words that read as grammar, not a topic. Deliberately wider than the memory
 * recall stop list: a chip row is a browsing surface, so 'today' or 'really'
 * as a chip would be noise a writer cannot act on.
 */
const CHIP_STOP_WORDS = new Set([
    'about', 'after', 'again', 'because', 'before', 'being', 'could',
    'doing', 'feel', 'feeling', 'felt', 'from', 'have', 'just', 'like',
    'more', 'much', 'only', 'over', 'really', 'some', 'still', 'that',
    'than', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those',
    'through', 'today', 'very', 'want', 'was', 'were', 'what', 'when',
    'where', 'which', 'while', 'with', 'would', 'your', 'you',
]);

const MIN_CHIP_WORD_LENGTH = 4;
const MAX_CHIP_WORD_LENGTH = 18;

/** Lowercase, keep Unicode letters/digits/marks, drop punctuation. */
function normalizeWord(value: string): string {
    return value.toLowerCase().replace(/[^\p{L}\p{N}\p{M}]/gu, '');
}

/**
 * Topic words for ONE item. Returns a SET: a word repeated ten times in a
 * long entry is still one mention of that topic, so it cannot outrank a word
 * that appears across ten different entries.
 */
export function topicWordsForItem(item: HistoryItem): ReadonlySet<string> {
    const text = item.searchableText || `${item.title} ${item.summary} ${item.mood ?? ''}`;
    const words = new Set<string>();
    text.split(/\s+/).forEach((raw) => {
        const word = normalizeWord(raw);
        if (word.length < MIN_CHIP_WORD_LENGTH || word.length > MAX_CHIP_WORD_LENGTH) return;
        if (CHIP_STOP_WORDS.has(word)) return;
        words.add(word);
    });
    return words;
}

/** Case/whitespace-safe chip key, so the UI can toggle with a plain string. */
export function normalizeTopic(value: string): string {
    return normalizeWord(value.trim());
}

export function topicMatchesItem(item: HistoryItem, topic: string): boolean {
    const key = normalizeTopic(topic);
    return key.length > 0 && topicWordsForItem(item).has(key);
}

/**
 * Rank topics across ALL sections by DISTINCT item count (not mentions).
 * Ties break alphabetically so the row never jitters between renders.
 * `limit` only trims the returned list; counts always cover the full feed.
 */
export function collectTopicChips(
    sections: readonly HistorySection[],
    limit: number = TOPIC_CHIP_LIMIT,
): TopicChip[] {
    const counts = new Map<string, number>();
    sections.forEach((section) => {
        section.items.forEach((item) => {
            topicWordsForItem(item).forEach((word) => {
                counts.set(word, (counts.get(word) ?? 0) + 1);
            });
        });
    });
    const ranked = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : TOPIC_CHIP_LIMIT;
    return ranked.slice(0, safeLimit).map(([label, count]) => ({ label, count }));
}

/**
 * Keep only items matching a topic. Sections with no matches disappear
 * entirely rather than leaving a bare date heading behind.
 */
export function filterSectionsByTopic(
    sections: readonly HistorySection[],
    topic: string,
): HistorySection[] {
    if (normalizeTopic(topic).length === 0) return sections.map((section) => ({ ...section }));
    const result: HistorySection[] = [];
    sections.forEach((section) => {
        const items = section.items.filter((item) => topicMatchesItem(item, topic));
        if (items.length > 0) result.push({ ...section, items });
    });
    return result;
}

/**
 * Recount the visible chips against the CURRENT filtered feed. A chip's count
 * must say how many entries are actually behind it, not how many existed
 * before a search or the starred filter narrowed the list.
 */
export function countTopicItems(sections: readonly HistorySection[], topic: string): number {
    return filterSectionsByTopic(sections, topic).reduce(
        (total, section) => total + section.items.length,
        0,
    );
}
