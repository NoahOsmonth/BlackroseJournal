/**
 * Eager history injection for models/providers that lack tool calling.
 * Detects temporal / history questions and attaches a short day digest block
 * plus on-demand session-digest recall (Memory v3 Phase 3).
 */

import {
    formatDayDigestForTool,
    getDayDigest,
    listDayDigests,
} from '@/services/memory/dayDigestStorage';
import { buildSessionRecallContext } from '@/services/memory/sessionRecall';
import { resolveRelativeDateKey } from '@/utils/date';

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
    const parts: string[] = [];
    const retrieved = await buildRetrievedHistoryContext(userText, now);
    if (retrieved) parts.push(retrieved);

    // Session digests: turn-only temporal/topical recall (soft-fails offline).
    try {
        const sessionRecall = await buildSessionRecallContext(userText, { now });
        if (sessionRecall) parts.push(sessionRecall);
    } catch (error) {
        console.warn('Session recall context failed:', error);
    }

    if (parts.length === 0) return systemPrompt;
    return `${systemPrompt}\n\n${parts.join('\n\n')}`;
}
