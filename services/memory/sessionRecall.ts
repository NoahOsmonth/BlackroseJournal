/**
 * Phase 3 — on-demand temporal / topical session-digest recall.
 *
 * Trigger is heuristic-first (no guaranteed LLM classifier call per message).
 * On trigger: date-range filter and/or embedding cosine vs session digests.
 * Injected only for that turn via historyPrefetch → ## Relevant past context.
 *
 * Offline: embeddings soft-fail → date-range-only (or empty if no date phrase).
 */

import { embedText } from '@/services/ai/embeddingsTransport';
import { cosineSimilarity } from '@/services/memory/embeddings';
import { listMemoryRollups } from '@/services/memory/memoryRollupStorage';
import type { MemoryRollup } from '@/services/memory/memoryRollup.types';
import {
    getSessionDigest,
    listSessionDigestIndex,
    listSessionDigests,
} from '@/services/memory/sessionDigestStorage';
import type { SessionDigest } from '@/services/memory/sessionDigest.types';
import {
    addLocalDays,
    getLocalDateKey,
} from '@/utils/date';

const MAX_RECALL_LINES = 5;
const MIN_SIMILARITY = 0.28;

/** Temporal phrases that imply looking at past sessions. */
const TEMPORAL_RECALL_RE =
    /\b(last\s+(week|month|year|time)|this\s+(week|month|year)|yesterday|what\s+did\s+we\s+talk|what\s+have\s+we\s+(talked|discussed)|when\s+we\s+(talked|spoke|discussed)|past\s+(sessions?|entries|conversations?)|a\s+while\s+ago|earlier\s+(this\s+)?(week|month|year))\b/i;

/** Topic / mention recall phrasing. */
const TOPIC_RECALL_RE =
    /\b(did\s+i\s+(mention|say|talk|write|journal)|what\s+did\s+i\s+(say|mention|write|talk|journal)|last\s+time\s+i\s+(mentioned|said|talked|wrote)|have\s+i\s+(mentioned|talked|said)|remind\s+me\s+(what|about)|about\s+my\s+\w+)\b/i;

export interface DateRangeFilter {
    from: string;
    to: string;
    label: string;
}

export interface SessionRecallMatch {
    digest: SessionDigest;
    score: number;
    reason: 'date' | 'semantic' | 'date+semantic';
}

export interface RollupRecallMatch {
    rollup: MemoryRollup;
    score: number;
    reason: 'date' | 'semantic' | 'date+semantic';
}

/**
 * True when the user message looks like past/topic recall.
 * What would make tests fail: matching every greeting, or missing "last month".
 */
export function detectSessionRecallIntent(text: string): boolean {
    const t = text.trim();
    if (!t || t.length < 8) return false;
    if (TEMPORAL_RECALL_RE.test(t)) return true;
    if (TOPIC_RECALL_RE.test(t)) return true;
    return false;
}

/**
 * Map common phrases to a local date range (inclusive YYYY-MM-DD).
 */
export function resolveSessionRecallDateRange(
    text: string,
    now: Date = new Date(),
): DateRangeFilter | null {
    const raw = text.trim().toLowerCase();
    const today = getLocalDateKey(now);

    if (/\blast\s+year\b/.test(raw) || /\bthis\s+past\s+year\b/.test(raw)) {
        return {
            from: getLocalDateKey(addLocalDays(now, -365)),
            to: today,
            label: 'last year',
        };
    }
    if (/\blast\s+month\b/.test(raw) || /\bpast\s+month\b/.test(raw)) {
        return {
            from: getLocalDateKey(addLocalDays(now, -30)),
            to: today,
            label: 'last month',
        };
    }
    if (/\blast\s+week\b/.test(raw) || /\bpast\s+week\b/.test(raw) || /\bthis\s+week\b/.test(raw)) {
        return {
            from: getLocalDateKey(addLocalDays(now, -7)),
            to: today,
            label: /\bthis\s+week\b/.test(raw) ? 'this week' : 'last week',
        };
    }
    if (/\byesterday\b/.test(raw)) {
        const y = getLocalDateKey(addLocalDays(now, -1));
        return { from: y, to: y, label: 'yesterday' };
    }
    return null;
}

function formatRecallLine(digest: SessionDigest): string {
    const topics = digest.topics.length > 0
        ? ` [${digest.topics.slice(0, 4).join(', ')}]`
        : '';
    const summary = digest.oneLineSummary.replace(/\s+/g, ' ').trim();
    return `- Written ${digest.dateISO}${topics}: ${summary}`;
}

function formatRollupLine(rollup: MemoryRollup): string {
    const topics = rollup.topics.length > 0
        ? ` [${rollup.topics.slice(0, 4).join(', ')}]`
        : '';
    const summary = rollup.summary.replace(/\s+/g, ' ').trim();
    return `- Period ${rollup.kind} ${rollup.periodKey} (${rollup.dateFrom}→${rollup.dateTo})${topics}: ${summary}`;
}

/**
 * Prefer month/year rollups when the user asks about last month/year and
 * individual session digests would be too many or sparse.
 */
async function rankRollupsForRecall(
    userText: string,
    range: DateRangeFilter | null,
    queryEmbedding: number[] | null,
    now: Date,
    limit: number,
): Promise<RollupRecallMatch[]> {
    // Prefer coarser grains for longer windows.
    let kind: 'week' | 'month' | 'year' | undefined;
    if (range?.label === 'last year') kind = 'year';
    else if (range?.label === 'last month') kind = 'month';
    else if (range?.label === 'last week' || range?.label === 'this week') kind = 'week';
    else if (/\blast\s+year\b/i.test(userText)) kind = 'year';
    else if (/\blast\s+month\b/i.test(userText)) kind = 'month';
    else kind = undefined;

    const rollups = await listMemoryRollups({
        kind,
        from: range?.from,
        to: range?.to,
        limit: 40,
    });
    if (rollups.length === 0) return [];

    const scored: RollupRecallMatch[] = rollups.map((rollup) => {
        if (
            queryEmbedding
            && queryEmbedding.length > 0
            && rollup.embedding.length === queryEmbedding.length
        ) {
            return {
                rollup,
                score: cosineSimilarity(queryEmbedding, rollup.embedding),
                reason: (range ? 'date+semantic' : 'semantic') as RollupRecallMatch['reason'],
            };
        }
        const ageDays = Math.max(0, (now.getTime() - rollup.updatedAt) / 86_400_000);
        return {
            rollup,
            score: range ? Math.max(0.35, 1 - ageDays / 90) : 0.2,
            reason: (range ? 'date' : 'semantic') as RollupRecallMatch['reason'],
        };
    });
    scored.sort((a, b) => b.score - a.score);
    const hasSemantic = Boolean(queryEmbedding);
    const filtered = hasSemantic
        ? scored.filter((m) => m.score >= MIN_SIMILARITY)
        : scored;
    return filtered.slice(0, limit);
}

/**
 * Rank session digests for a recall query. Embeddings optional (null = date-only).
 */
export async function rankSessionDigestsForRecall(
    userText: string,
    options: {
        now?: Date;
        /** Injected for tests — skip network embed. */
        queryEmbedding?: number[] | null;
        /** Skip embed entirely (tests / offline forced). */
        skipEmbed?: boolean;
        limit?: number;
    } = {},
): Promise<SessionRecallMatch[]> {
    const now = options.now ?? new Date();
    const limit = options.limit ?? MAX_RECALL_LINES;
    const range = resolveSessionRecallDateRange(userText, now);

    let digests: SessionDigest[];
    if (range) {
        digests = await listSessionDigests({ from: range.from, to: range.to });
    } else {
        // Topic / "last time" — scan recent index cap (not full history dump).
        const index = await listSessionDigestIndex({ limit: 80 });
        digests = [];
        for (const entry of index) {
            const row = await getSessionDigest(entry.id);
            if (row) digests.push(row);
        }
    }

    if (digests.length === 0) return [];

    let queryEmbedding: number[] | null | undefined = options.queryEmbedding;
    if (queryEmbedding === undefined && !options.skipEmbed) {
        queryEmbedding = await embedText(userText);
    }
    if (queryEmbedding === undefined) queryEmbedding = null;

    const scored: SessionRecallMatch[] = digests.map((digest) => {
        if (
            queryEmbedding
            && queryEmbedding.length > 0
            && digest.embedding.length > 0
            && digest.embedding.length === queryEmbedding.length
        ) {
            const score = cosineSimilarity(queryEmbedding, digest.embedding);
            return {
                digest,
                score,
                reason: (range ? 'date+semantic' : 'semantic') as SessionRecallMatch['reason'],
            };
        }
        // Date-only / offline: recency within the set as weak score.
        const ageDays = Math.max(
            0,
            (now.getTime() - digest.createdAt) / 86_400_000,
        );
        const score = range ? Math.max(0.35, 1 - ageDays / 60) : 0.2;
        return {
            digest,
            score,
            reason: (range ? 'date' : 'semantic') as SessionRecallMatch['reason'],
        };
    });

    scored.sort((a, b) => b.score - a.score);

    // When semantic scores exist, drop weak ones; date-only keeps top by recency.
    const hasSemantic = scored.some(
        (m) => m.reason === 'semantic' || m.reason === 'date+semantic',
    );
    const filtered = hasSemantic && queryEmbedding
        ? scored.filter((m) => m.score >= MIN_SIMILARITY)
        : scored;

    return filtered.slice(0, limit);
}

/**
 * Build turn-only "## Relevant past context" block, or undefined if no trigger/matches.
 */
export async function buildSessionRecallContext(
    userText: string,
    options: {
        now?: Date;
        queryEmbedding?: number[] | null;
        skipEmbed?: boolean;
    } = {},
): Promise<string | undefined> {
    if (!detectSessionRecallIntent(userText)) return undefined;

    const now = options.now ?? new Date();
    const range = resolveSessionRecallDateRange(userText, now);

    // Single embed for session digests + rollups (same EMBEDDING_MODEL via embedText).
    let queryEmbedding: number[] | null | undefined = options.queryEmbedding;
    if (queryEmbedding === undefined && !options.skipEmbed) {
        queryEmbedding = await embedText(userText);
    }
    if (queryEmbedding === undefined) queryEmbedding = null;

    const matches = await rankSessionDigestsForRecall(userText, {
        ...options,
        queryEmbedding,
        skipEmbed: true,
    });

    // Coarser grain for month/year (or when session digests are sparse).
    const wantRollups = Boolean(
        range
        && (range.label === 'last month' || range.label === 'last year' || matches.length < 2),
    );
    const rollupMatches = wantRollups
        ? await rankRollupsForRecall(
            userText,
            range,
            queryEmbedding,
            now,
            MAX_RECALL_LINES,
        )
        : [];

    if (matches.length === 0 && rollupMatches.length === 0) {
        if (range) {
            return [
                '## Relevant past context',
                `No finished session digests or period rollups found for ${range.label} (${range.from} → ${range.to}).`,
                'Digests are created when the user finishes a journal or check-in; week/month/year rollups build lazily on app open.',
            ].join('\n');
        }
        return undefined;
    }

    const headerNote = range
        ? `Date window: ${range.label} (${range.from} → ${range.to}).`
        : 'Matched by topic / recency across recent session digests.';

    const sessionLines = matches.slice(0, MAX_RECALL_LINES).map((m) => formatRecallLine(m.digest));
    const rollupLines = rollupMatches.map((m) => formatRollupLine(m.rollup));
    // Prefer a few rollups first for long windows, then session lines.
    const body = [...rollupLines, ...sessionLines].slice(0, MAX_RECALL_LINES);

    return [
        '## Relevant past context',
        'On-demand session digests / period rollups for THIS turn only — not always-on memory. Prefer these when answering temporal/topic recall questions.',
        headerNote,
        ...body,
    ].join('\n');
}
