/**
 * Finish-path session digest builder.
 *
 * One flash chat call → { oneLineSummary, topics, eventDate? }
 * One embeddings call → vector for summary (+ topics)
 * Then sharded upsert via sessionDigestStorage.
 *
 * Soft-fails: never blocks Finish. Missing embed still stores text digest
 * (Phase 3 falls back to date-range-only when embedding is empty).
 * eventDate is optional best-effort — null on absence/parse failure (warns).
 */

import {
    extractFirstJsonObject,
    fetchDirectJsonCompletion,
} from '@/services/ai/jsonCompletion';
import { embedText } from '@/services/ai/embeddingsTransport';
import { INSIGHTS_TEMPERATURE } from '@/services/ai/generationSettings';
import {
    getLocalDateKey,
    getLocalDateKeyFromTimestamp,
    normalizeEventDate,
} from '@/utils/date';
import { upsertSessionDigest } from './sessionDigestStorage';
import type { SessionDigest, SessionDigestSourceKind } from './sessionDigest.types';

const DIGEST_SYSTEM_PROMPT = `You summarize a finished journaling session for later recall.

Return ONLY valid JSON:
{
  "oneLineSummary": string,
  "topics": string[],
  "eventDate": string | null
}

Rules:
- oneLineSummary: 1–2 sentences, concrete, third-person about the user (e.g. "Talked about work pressure and sleep.").
- topics: 2–6 short lowercase tags (e.g. "work stress", "family", "sleep").
- eventDate: OPTIONAL absolute date for a SPECIFIC datable life event the user mentioned.
  Set ONLY when the text clearly references a calendar-bound event (a weekday name like "Friday",
  "tomorrow", "next Tuesday", or an explicit YYYY-MM-DD). Resolve relative weekday/date phrases
  against the WRITE DAY clock provided in the user message to an absolute YYYY-MM-DD.
  Example: write day Saturday 2026-07-18 + "dentist appointment on Friday" → "2026-07-24".
  If undatable or no specific event, set eventDate to null. Never invent dates.
- No markdown, no preamble. Never invent events not in the text.
- If the transcript is empty fluff, still return a brief honest summary with eventDate null.`;

export interface BuildSessionDigestInput {
    sessionId: string;
    sourceKind: SessionDigestSourceKind;
    sourceId: string;
    userMessages: readonly string[];
    /** Override clock (tests). */
    now?: number;
}

export interface ParsedDigestFields {
    oneLineSummary: string;
    topics: string[];
    /** Raw model value before normalize (tests). */
    rawEventDate?: unknown;
    eventDate: string | null;
}

function countWords(text: string): number {
    const parts = text.trim().split(/\s+/).filter(Boolean);
    return parts.length;
}

/**
 * Parse + normalize digest JSON. eventDate failures → null + conspicuous warn
 * (never throw). Exported for unit tests.
 */
export function parseDigestJson(
    raw: string,
    writeDay: Date,
): ParsedDigestFields | null {
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

        const rawEventDate = parsed.eventDate;
        let eventDate: string | null = null;
        if (rawEventDate !== undefined && rawEventDate !== null && rawEventDate !== '') {
            eventDate = normalizeEventDate(rawEventDate, writeDay);
            if (!eventDate) {
                console.warn(
                    '[eventDate] Session digest eventDate unparseable; storing null. raw=',
                    JSON.stringify(rawEventDate),
                );
            }
        }

        return {
            oneLineSummary,
            topics: topics.slice(0, 8),
            rawEventDate,
            eventDate,
        };
    } catch {
        return null;
    }
}

async function requestSummaryTopics(
    transcript: string,
    writeDay: Date,
): Promise<ParsedDigestFields | null> {
    const writeKey = getLocalDateKey(writeDay);
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
                            content: [
                                `Write day (device local clock for resolving relative dates): ${writeKey}`,
                                `Session user writing:\n${transcript.slice(0, 6000)}`,
                            ].join('\n\n'),
                        },
                    ],
                    temperature: INSIGHTS_TEMPERATURE,
                    max_tokens: 300,
                },
                { modelPurpose: 'flash' },
            );
            const parsed = parseDigestJson(content, writeDay);
            if (parsed) return parsed;
            lastFail = new Error('unparseable digest JSON');
        } catch (error) {
            lastFail = error;
        }
    }
    console.warn('Session digest summary failed:', lastFail);
    return null;
}

function fallbackSummary(transcript: string, wordCount: number): ParsedDigestFields {
    const snippet = transcript.replace(/\s+/g, ' ').trim().slice(0, 180);
    return {
        oneLineSummary: snippet
            ? `Journaled about: ${snippet}${transcript.length > 180 ? '…' : ''}`
            : 'Completed a short journaling session.',
        topics: wordCount > 0 ? ['journal'] : [],
        eventDate: null,
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
        const writeDay = new Date(now);
        const dateISO = getLocalDateKeyFromTimestamp(now);

        const llm = await requestSummaryTopics(userBlob, writeDay);
        const { oneLineSummary, topics, eventDate } = llm ?? fallbackSummary(userBlob, wordCount);

        const embedInput = [oneLineSummary, ...topics].filter(Boolean).join('\n');
        const embedding = (await embedText(embedInput)) ?? [];

        const digest: SessionDigest = {
            schemaVersion: 1,
            sessionId: input.sessionId,
            dateISO,
            oneLineSummary,
            topics,
            eventDate: eventDate ?? null,
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
