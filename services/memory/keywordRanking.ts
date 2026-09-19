/**
 * Shared keyword + recency ranking used by the on-device memory recall paths
 * (local memory capsule + session-digest recall).
 *
 * Replaces the removed app-side semantic embedding stack. All relevance
 * scoring is pure lexical keyword overlap with a small recency boost — no
 * network, no vectors, never throws.
 *
 * `utils/` is off-limits for this (no I/O) — these are pure string/math
 * helpers and live here so both memory services share ONE implementation.
 */

/** Low-signal words dropped during tokenization. */
const STOP_WORDS = new Set([
    'about',
    'after',
    'again',
    'because',
    'before',
    'being',
    'could',
    'doing',
    'feel',
    'feeling',
    'from',
    'have',
    'more',
    'that',
    'this',
    'with',
]);

/** Lowercase, strip punctuation/whitespace, keep apostrophes. */
export function normalizeToken(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9']/g, '');
}

/** Split free text into usable query/candidate tokens (len > 3, non-stop-word). */
export function tokenize(text: string): string[] {
    return text
        .split(/\s+/)
        .map(normalizeToken)
        .filter((token) => token.length > 3 && !STOP_WORDS.has(token));
}

/**
 * Fraction of query tokens present in a candidate's tokens, in [0, 1].
 * Returns 0 for an empty query. Denominator is at least 3 so a single rare
 * overlap does not saturate the score.
 */
export function overlapRatio(
    candidateTokens: readonly string[],
    queryTokens: ReadonlySet<string>,
): number {
    if (queryTokens.size === 0) return 0;
    const overlap = candidateTokens.filter((token) => queryTokens.has(token)).length;
    return Math.min(1, overlap / Math.max(3, queryTokens.size));
}

/** Recency factor in [0, 1] — halves roughly every ~30 days. */
export function recencyFactor(createdAt: number, now: number): number {
    const ageDays = Math.max(0, (now - createdAt) / 86_400_000);
    return 1 / (1 + ageDays / 30);
}

/**
 * Number of distinct query tokens found in a candidate. Used as a soft
 * relevance gate (only candidates sharing ≥1 token are keyword matches).
 */
export function overlapCount(candidateTokens: readonly string[], queryTokens: ReadonlySet<string>): number {
    if (queryTokens.size === 0) return 0;
    let count = 0;
    for (const token of candidateTokens) {
        if (queryTokens.has(token)) count += 1;
    }
    return count;
}

/**
 * Combined relevance score in [0, 1]: keyword overlap weighted 0.7 plus
 * recency weighted 0.3. This is the baseline ranking for both memory paths.
 */
export function scoreKeywordRecency(
    candidateTokens: readonly string[],
    queryTokens: ReadonlySet<string>,
    createdAt: number,
    now: number,
): number {
    return overlapRatio(candidateTokens, queryTokens) * 0.7 + recencyFactor(createdAt, now) * 0.3;
}

/** Dedupe, trim, drop empties — insertion order preserved. */
function uniqueValues(values: readonly string[]): string[] {
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

/**
 * Top tags for a piece of text: the highest-frequency tokens, seed tags first.
 *
 * Lives here rather than in `localMemory.ts` because it is pure and two callers
 * need it — the memory store and the Explore composer's live "Filed under"
 * preview. Importing the store for a pure string function dragged the whole
 * AsyncStorage write path into the component graph.
 */
export function extractTags(text: string, seedTags: readonly string[] = []): string[] {
    const counts = new Map<string, number>();
    tokenize(text).forEach((token) => counts.set(token, (counts.get(token) ?? 0) + 1));
    const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    return uniqueValues([...seedTags, ...ranked.slice(0, 8).map(([token]) => token)]);
}

/**
 * Matches the atom store's own 600-char trim, so every store holds the same
 * text. Lives here (not in the write path) for the same reason `extractTags`
 * does: the composer's preview must clip identically without pulling the
 * AsyncStorage write path into the component graph.
 */
export const MAX_NOTE_CHARS = 600;

/**
 * One clipped value, used by every store — and by the composer's preview, so
 * what the writer sees filed is what actually gets filed. Clipping per store
 * (or previewing from unclipped text) is how recall returns text, or themes,
 * the writer never saw in that shape.
 */
export function clipNoteText(text: string): string {
    const collapsed = text.trim().replace(/\s+/g, ' ');
    return collapsed.length > MAX_NOTE_CHARS
        ? collapsed.slice(0, MAX_NOTE_CHARS).trimEnd()
        : collapsed;
}