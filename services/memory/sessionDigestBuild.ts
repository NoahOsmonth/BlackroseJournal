/**
 * Finish-path session digest builder.
 *
 * One flash chat call → { oneLineSummary, topics }
 * One embeddings call → vector for summary (+ topics)
 * Then sharded upsert via sessionDigestStorage.
 *
 * Soft-fails: never blocks Finish. Missing embed still stores text digest
 * (Phase 3 falls back to date-range-only when embedding is empty).
 */

import {
    extractFirstJsonObject,
    fetchDirectJsonCompletion,
} from '@/services/ai/jsonCompletion';
import { embedText } from '@/services/ai/embeddingsTransport';
import { INSIGHTS_TEMPERATURE } from '@/services/ai/generationSettings';
import { getLocalDateKeyFromTimestamp } from '@/utils/date';
import { upsertSessionDigest } from './sessionDigestStorage';
import type { SessionDigest, SessionDigestSourceKind } from './sessionDigest.types';

const DIGEST_SYSTEM_PROMPT = `You summarize a finished journaling session for later recall.

Return ONLY valid JSON:
{
  "oneLineSummary": string,
  "topics": string[]
}

Rules:
- oneLineSummary: 1–2 sentences, concrete, third-person about the user (e.g. "Talked about work pressure and sleep.").
- topics: 2–6 short lowercase tags (e.g. "work stress", "family", "sleep").
- No markdown, no preamble. Never invent events not in the text.
- If the transcript is empty fluff, still return a brief honest summary.`;

export interface BuildSessionDigestInput {
    sessionId: string;
    sourceKind: SessionDigestSourceKind;
    sourceId: string;
    userMessages: readonly string[];
    /** Override clock (tests). */
    now?: number;
}

function countWords(text: string): number {
    const parts = text.trim().split(/\s+/).filter(Boolean);
    return parts.length;
}

function parseDigestJson(raw: string): { oneLineSummary: string; topics: string[] } | null {
    const jsonText = extractFirstJsonObject(raw) ?? raw;
    try {
        const parsed = JSON.parse(jsonText) as Record<string, unknown>;
        if (typeof parsed !== 'object' || parsed === null) return null;
        const oneLineSummary = typeof parsed.oneLineSummary === 'string'
            ? parsed.oneLineSummary.trim()
            : '';
        if (!oneLineSummary) return null;
        const topics: string[] = [];
        if (Array.isArray(parsed.topics)) {
            for (const t of parsed.topics) {
                if (typeof t === 'string' && t.trim()) topics.push(t.trim());
            }
        }
        return { oneLineSummary, topics: topics.slice(0, 8) };
    } catch {
        return null;
    }
}

async function requestSummaryTopics(transcript: string): Promise<{ oneLineSummary: string; topics: string[] } | null> {
    let lastFail: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const { content } = await fetchDirectJsonCompletion(
                {
                    model: 'agent-default',
                    messages: [
                        { role: 'system', content: DIGEST_SYSTEM_PROMPT },
                        {
                            role: 'user',
                            content: `Session user writing:\n${transcript.slice(0, 6000)}`,
                        },
                    ],
                    temperature: INSIGHTS_TEMPERATURE,
                    max_tokens: 300,
                },
                { modelPurpose: 'flash' },
            );
            const parsed = parseDigestJson(content);
            if (parsed) return parsed;
            lastFail = new Error('unparseable digest JSON');
        } catch (error) {
            lastFail = error;
        }
    }
    console.warn('Session digest summary failed:', lastFail);
    return null;
}

function fallbackSummary(transcript: string, wordCount: number): { oneLineSummary: string; topics: string[] } {
    const snippet = transcript.replace(/\s+/g, ' ').trim().slice(0, 180);
    return {
        oneLineSummary: snippet
            ? `Journaled about: ${snippet}${transcript.length > 180 ? '…' : ''}`
            : 'Completed a short journaling session.',
        topics: wordCount > 0 ? ['journal'] : [],
    };
}

/**
 * Build + persist a session digest. Soft-fails to null (Finish must not block).
 */
export async function buildAndSaveSessionDigest(
    input: BuildSessionDigestInput,
): Promise<SessionDigest | null> {
    try {
        const userBlob = input.userMessages.map((m) => m.trim()).filter(Boolean).join('\n\n');
        const wordCount = countWords(userBlob);
        if (!userBlob || wordCount === 0) return null;

        const now = input.now ?? Date.now();
        const dateISO = getLocalDateKeyFromTimestamp(now);

        const llm = await requestSummaryTopics(userBlob);
        const { oneLineSummary, topics } = llm ?? fallbackSummary(userBlob, wordCount);

        const embedInput = [oneLineSummary, ...topics].filter(Boolean).join('\n');
        const embedding = (await embedText(embedInput)) ?? [];

        const digest: SessionDigest = {
            schemaVersion: 1,
            sessionId: input.sessionId,
            dateISO,
            oneLineSummary,
            topics,
            embedding,
            entryWordCount: wordCount,
            createdAt: now,
            sourceKind: input.sourceKind,
            sourceId: input.sourceId,
        };

        return await upsertSessionDigest(digest);
    } catch (error) {
        console.warn('buildAndSaveSessionDigest failed:', error);
        return null;
    }
}
