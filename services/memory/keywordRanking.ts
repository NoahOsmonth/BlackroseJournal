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