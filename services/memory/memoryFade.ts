import { scoreKeywordRecency, tokenize } from './keywordRanking';
import type { MemoryFileHeader } from './memoryFiles';

/**
 * R2 — fading for file-memory recall selection.
 *
 * Selection used to be a raw count of query tokens found in
 * `name + description`, with ties broken by wall-clock `updatedAt`. Three
 * measured problems followed (R0/R1 ledger):
 *
 *   1. Every matching token counted the same, so a thread's templated
 *      near-duplicates outranked the file the user actually meant.
 *      `precision-topical` selected 5 distractors and 0 expected files.
 *   2. The tie-break was wall-clock, so equally-scored files came back in a
 *      different order on every run — the same probe picked different files
 *      run to run, so no precision number was reproducible.
 *   3. Sub-day recency was noise: files staged milliseconds apart scored
 *      differently, which made even the *set* of selected files unstable.
 *
 * Fading fixes all three by reusing the repo's ONE shared relevance baseline
 * (`keywordRanking.scoreKeywordRecency`: keyword overlap 0.7 + recency 0.3),
 * already used to rank memory atoms and session digests.
 *
 * Two deliberate choices:
 *
 * - **Fade by capture date, not consolidation date.** Dream rewrites
 *   `updatedAt` when it promotes a staged file, so every file in a freshly
 *   consolidated thread would look equally new. `capturedAt` is when the
 *   memory was actually written — the thing fading should track.
 * - **Fade at day resolution.** Recency is floored to a day boundary, so a
 *   few milliseconds of staging jitter cannot reorder equal-scoring files.
 *   A 30-day half-life is unaffected by a sub-day offset, and the selection
 *   becomes byte-for-byte reproducible for a fixed store.
 *
 * Pure: no I/O, no storage keys, no side effects.
 */

export interface RankedMemoryFile {
    readonly header: MemoryFileHeader;
    readonly score: number;
}

const DAY_MS = 86_400_000;

/**
 * Capture time in epoch ms — ordering only, for "which memory came first".
 * Unparseable timestamps fall to the epoch so a corrupt header loses.
 *
 * Supersession uses this (ms) rather than the faded day: deciding which of two
 * restatements is the current truth needs the finer grain. Recall fading uses
 * the day-floored form below, where sub-day jitter is noise.
 */
export function memoryCapturedAtMs(
    header: Pick<MemoryFileHeader, 'capturedAt' | 'updatedAt'>,
): number {
    const raw = header.capturedAt ?? header.updatedAt;
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Capture day, floored to a UTC day boundary. Unparseable timestamps fade to
 * the epoch so a corrupt header sorts last instead of winning.
 */
export function memoryCaptureDayMs(
    header: Pick<MemoryFileHeader, 'capturedAt' | 'updatedAt'>,
): number {
    const captured = memoryCapturedAtMs(header);
    return captured === 0 ? 0 : Math.floor(captured / DAY_MS) * DAY_MS;
}

/**
 * The tokens a header is matched on.
 *
 * **Deduplicated on purpose.** `keywordRanking.overlapRatio` counts matching
 * *occurrences*, so a templated description that repeats one common word
 * ("…ink notes about nib notes…" → `notes` three times) saturates the ratio to
 * 1.0 and ties the file that actually matched two distinct query terms. That is
 * the same templated-header trap the R0 ledger's distractors expose, so the
 * distinct-token set is what a lexical relevance score should use here.
 *
 * The shared `overlapRatio` is left untouched: it also ranks memory atoms and
 * session digests, whose behaviour R2 has not measured.
 */
export function memoryHeaderTokens(header: Pick<MemoryFileHeader, 'name' | 'description'>): string[] {
    return Array.from(new Set(tokenize(header.name + ' ' + header.description)));
}

/**
 * Deterministic for a fixed store: equal scores fall back to capture day
 * (newest first) and then id — never a raw clock read, so a rerun cannot
 * reshuffle either the selection or its order.
 */
export function rankMemoryFiles(
    headers: readonly MemoryFileHeader[],
    query: string,
    now: number = Date.now(),
): RankedMemoryFile[] {
    const queryTokens = new Set(tokenize(query));
    return headers
        .map((header) => ({
            header,
            score: scoreKeywordRecency(
                memoryHeaderTokens(header),
                queryTokens,
                memoryCaptureDayMs(header),
                now,
            ),
        }))
        .sort((a, b) =>
            b.score - a.score
            || memoryCaptureDayMs(b.header) - memoryCaptureDayMs(a.header)
            || a.header.id.localeCompare(b.header.id));
}
