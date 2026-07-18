/**
 * Eager history injection for models/providers that lack tool calling.
 * Detects temporal / history questions and attaches a short day digest block
 * plus on-demand session-digest recall (Memory v3 Phase 3).
 *
 * PR8c: AUGMENT_BLOB_MAX_EST_TOKENS caps the eager blob; trim lowest-similarity
 * recall lines first, then oldest digests; never mid-sentence (whole lines only).
 */

import {
    formatDayDigestForTool,
    getDayDigest,
    listDayDigests,
} from '@/services/memory/dayDigestStorage';
import { buildSessionRecallContext } from '@/services/memory/sessionRecall';
import { resolveRelativeDateKey } from '@/utils/date';
import { estimateTokensFromChars } from './promptBudget';

/** PR8c: max estimated tokens (chars/4) for eager augment blob. */
export const AUGMENT_BLOB_MAX_EST_TOKENS = 1_500;

const HISTORY_INTENT_RE =
    /\b(yesterday|today|tomorrow|last\s+(week|night|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)|this\s+week|last\s+month|what\s+did\s+i\s+(talk|write|say|journal|share|mention)|what\s+did\s+we\s+talk|what\s+was\s+i\s+(talking|writing)|remember\s+when|past\s+(entry|entries|conversation|session)|on\s+\d{4}-\d{2}-\d{2}|full\s+(conversation|transcript|entry))\b/i;

const RELATIVE_DATE_RE =
    /\b(yesterday|today|tomorrow|last\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})\b/gi;

export function detectHistoryIntent(text: string): boolean {
    return HISTORY_INTENT_RE.test(text.trim());
}

function extractDateHints(text: string, now: Date = new Date()): string[] {
    const keys: string[] = [];
    const matches = text.match(RELATIVE_DATE_RE) ?? [];
    for (const match of matches) {
        const resolved = resolveRelativeDateKey(match.trim(), now);
        if (resolved && !keys.includes(resolved)) keys.push(resolved);
    }
    return keys;
}

/** Segment of the eager augment blob — always whole lines / blocks (never mid-sentence). */
export type AugmentSegment = {
    role: 'fixed' | 'recall' | 'digest';
    text: string;
    /** Higher = keep longer. Drop lowest-similarity recall first. */
    similarity?: number;
    /** For digests: drop oldest dateKey first. */
    dateKey?: string;
};

function joinSegments(segments: readonly AugmentSegment[]): string {
    return segments
        .map((s) => s.text)
        .filter((t) => t.length > 0)
        .join('\n\n');
}

/**
 * Cap eager augment blob by estimated tokens. Trim order:
 * 1) lowest-similarity recall lines
 * 2) oldest digests (by dateKey)
 * Never mid-sentence — only whole segment drops.
 */
export function capAugmentSegments(
    segments: readonly AugmentSegment[],
    maxEstTokens: number = AUGMENT_BLOB_MAX_EST_TOKENS
): AugmentSegment[] {
    const kept = segments.map((s) => ({ ...s }));
    const overBudget = () => estimateTokensFromChars(joinSegments(kept).length) > maxEstTokens;

    while (overBudget()) {
        let dropIndex = -1;
        let bestSim = Infinity;
        for (let i = 0; i < kept.length; i += 1) {
            if (kept[i].role !== 'recall') continue;
            const sim = kept[i].similarity ?? 0;
            if (sim < bestSim) {
                bestSim = sim;
                dropIndex = i;
            }
        }
        if (dropIndex >= 0) {
            kept.splice(dropIndex, 1);
            continue;
        }

        dropIndex = -1;
        let oldestKey = '';
        for (let i = 0; i < kept.length; i += 1) {
            if (kept[i].role !== 'digest') continue;
            const key = kept[i].dateKey ?? '';
            if (dropIndex < 0 || key < oldestKey) {
                oldestKey = key;
                dropIndex = i;
            }
        }
        if (dropIndex >= 0) {
            kept.splice(dropIndex, 1);
            continue;
        }

        // Nothing left to drop safely.
        break;
    }

    return kept;
}

export function assembleAugmentBlob(
    segments: readonly AugmentSegment[],
    maxEstTokens: number = AUGMENT_BLOB_MAX_EST_TOKENS
): string {
    return joinSegments(capAugmentSegments(segments, maxEstTokens));
}

/**
 * Parse session-recall block into fixed header + body lines (recall role).
 * Body lines are assumed already ranked high→low similarity.
 */
export function segmentsFromSessionRecallBlock(block: string): AugmentSegment[] {
    const lines = block.split('\n');
    const header: string[] = [];
    const body: string[] = [];
    for (const line of lines) {
        if (line.startsWith('- ')) {
            body.push(line);
        } else {
            // Keep header / notes as fixed (before first body line or between).
            if (body.length === 0) {
                header.push(line);
            } else {
                // Trailing notes rare; attach as fixed.
                header.push(line);
            }
        }
    }
    const out: AugmentSegment[] = [];
    if (header.length > 0) {
        out.push({ role: 'fixed', text: header.join('\n') });
    }
    const n = Math.max(1, body.length);
    body.forEach((text, i) => {
        // First lines = highest similarity (already ranked).
        out.push({
            role: 'recall',
            text,
            similarity: 1 - i / n,
        });
    });
    return out;
}

/** Parse retrieved-history block into fixed header + digest segments. */
export function segmentsFromRetrievedHistoryBlock(block: string): AugmentSegment[] {
    const parts = block.split(/\n\n+/);
    const out: AugmentSegment[] = [];
    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('## ') || trimmed.startsWith('Pre-fetched') || trimmed.startsWith('No day')) {
            out.push({ role: 'fixed', text: trimmed });
            continue;
        }
        const dateMatch = /(?:writtenDate|date):\s*(\d{4}-\d{2}-\d{2})/i.exec(trimmed);
        const dateKey = dateMatch?.[1];
        out.push({
            role: 'digest',
            text: trimmed,
            dateKey: dateKey ?? '9999-99-99',
        });
    }
    return out;
}

export async function buildRetrievedHistoryContext(
    userText: string,
    now: Date = new Date()
): Promise<string | undefined> {
    if (!detectHistoryIntent(userText)) return undefined;

    const dateKeys = extractDateHints(userText, now);
    const blocks: string[] = [];

    if (dateKeys.length > 0) {
        for (const key of dateKeys.slice(0, 3)) {
            const digest = await getDayDigest(key);
            if (digest) {
                blocks.push(formatDayDigestForTool(digest));
            } else {
                blocks.push(`date: ${key}\nsummary: (no completed sessions on this day)`);
            }
        }
    } else {
        const recent = await listDayDigests({ limit: 3 });
        if (recent.length === 0) {
            return [
                '## Retrieved history',
                'No day digests on device yet. Completed journal entries create digests when the user finishes an entry.',
            ].join('\n');
        }
        blocks.push(...recent.map(formatDayDigestForTool));
    }

    if (blocks.length === 0) return undefined;
    return [
        '## Retrieved history',
        'Pre-fetched local day digests for this question. Prefer these facts; call tools only if a full transcript is needed.',
        ...blocks,
    ].join('\n\n');
}

export async function augmentSystemPromptForTurn(
    systemPrompt: string,
    userText: string,
    now: Date = new Date()
): Promise<string> {
    const segments: AugmentSegment[] = [];

    const retrieved = await buildRetrievedHistoryContext(userText, now);
    if (retrieved) {
        segments.push(...segmentsFromRetrievedHistoryBlock(retrieved));
    }

    // Session digests: turn-only temporal/topical recall (soft-fails offline).
    try {
        const sessionRecall = await buildSessionRecallContext(userText, { now });
        if (sessionRecall) {
            segments.push(...segmentsFromSessionRecallBlock(sessionRecall));
        }
    } catch (error) {
        console.warn('Session recall context failed:', error);
    }

    if (segments.length === 0) return systemPrompt;
    const blob = assembleAugmentBlob(segments, AUGMENT_BLOB_MAX_EST_TOKENS);
    if (!blob.trim()) return systemPrompt;
    return `${systemPrompt}\n\n${blob}`;
}
