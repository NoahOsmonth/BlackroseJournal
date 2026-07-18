/**
 * AI extraction of memory-graph atoms from finished journal / check-in sessions.
 * Soft-fails to an empty list so callers can apply a deterministic fallback.
 */

import {
    extractFirstJsonObject,
    fetchDirectJsonCompletion,
} from '@/services/ai/jsonCompletion';
import { INSIGHTS_TEMPERATURE } from '@/services/ai/generationSettings';
import type { Message } from '@/services/ai';
import type { JournalEntry } from '@/services/journal/journalStorage.types';
import type { IntentionCheckIn } from '@/services/intentions/intentionsStorage.types';
import { getLocalDateKey, normalizeEventDate } from '@/utils/date';
import type {
    LocalMemoryAtomInput,
    LocalMemoryLayer,
    LocalMemoryRootSourceKind,
    LocalMemorySource,
} from './localMemory.types';

const LAYERS: readonly LocalMemoryLayer[] = [
    'episodic',
    'semantic',
    'profile',
    'procedural',
    'note',
    'working',
];

const EXTRACTION_SYSTEM_PROMPT = `You extract durable personal memories from a finished journaling session for a local memory graph.

Return ONLY valid JSON:
{
  "atoms": [
    {
      "layer": "episodic" | "semantic" | "profile" | "procedural" | "note",
      "title": string,
      "content": string,
      "tags": string[],
      "salience": number,
      "confidence": number,
      "mergeKey": string,
      "eventDate": string | null
    }
  ]
}

Rules:
- 1–5 atoms. Always include exactly one episodic atom for this session.
- Up to 3 semantic theme atoms (recurring ideas). Up to 1 profile atom (who they are).
- title: short human phrase (max ~8 words). Never "About the user". Never start with "Recurring theme:".
- content: 1–3 natural sentences about THIS person (warm, specific, grounded in their words). Never meta language like "drawn from a journal entry", "system synthesis", "node", "memoryies", "shares a source", or "tags:".
- tags: 2–5 short lowercase labels.
- salience and confidence: 0–1.
- mergeKey: stable snake-ish key for theme/profile merges (e.g. "calm_mornings"). Episodic may use "session".
- eventDate: OPTIONAL absolute YYYY-MM-DD for a SPECIFIC datable life event. Prefer putting it on the episodic atom.
  Set ONLY when the text clearly references a calendar-bound event (weekday name, "tomorrow", "next Tuesday", explicit date).
  Resolve relative phrases against the WRITE DAY clock in the user message (e.g. Saturday 2026-07-18 + "Friday" → "2026-07-24").
  If undatable, set null. Never invent dates. Theme/profile atoms usually leave eventDate null.
- Prefer quality over quantity. Skip empty fluff.`;

interface ExtractedAtomRaw {
    layer?: unknown;
    title?: unknown;
    content?: unknown;
    tags?: unknown;
    salience?: unknown;
    confidence?: unknown;
    mergeKey?: unknown;
    eventDate?: unknown;
}

interface ExtractionResponse {
    atoms?: ExtractedAtomRaw[];
}

export interface MemoryExtractionContext {
    source: LocalMemorySource;
    rootSourceId: string;
    rootSourceKind: LocalMemoryRootSourceKind;
    sessionTitle: string;
    sessionKindLabel: string;
    entryText: string;
    assistantHints?: string;
    /** Write/finish day for resolving relative eventDate phrases (tests inject fixed clock). */
    now?: Date;
}

function clamp01(value: unknown, fallback: number): number {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(1, n));
}

function asLayer(value: unknown): LocalMemoryLayer | null {
    return typeof value === 'string' && (LAYERS as readonly string[]).includes(value)
        ? (value as LocalMemoryLayer)
        : null;
}

function asString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function asTags(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 6);
}

function normalizeMergeKey(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
}

function parseExtraction(raw: string): ExtractionResponse | null {
    const jsonText = extractFirstJsonObject(raw) ?? raw;
    try {
        return JSON.parse(jsonText) as ExtractionResponse;
    } catch {
        return null;
    }
}

function userTranscript(messages: readonly Message[] | undefined): string {
    if (!messages?.length) return '';
    return messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join('\n\n')
        .trim();
}

function toAtomInputs(
    ctx: MemoryExtractionContext,
    rawAtoms: readonly ExtractedAtomRaw[],
    writeDay: Date,
): LocalMemoryAtomInput[] {
    const out: LocalMemoryAtomInput[] = [];
    let episodicCount = 0;
    let semanticCount = 0;
    let profileCount = 0;

    for (const raw of rawAtoms) {
        const layer = asLayer(raw.layer);
        const title = asString(raw.title);
        const content = asString(raw.content);
        if (!layer || !title || !content) continue;
        if (layer === 'working') continue;

        if (layer === 'episodic') {
            if (episodicCount >= 1) continue;
            episodicCount += 1;
        } else if (layer === 'semantic') {
            if (semanticCount >= 3) continue;
            semanticCount += 1;
        } else if (layer === 'profile') {
            if (profileCount >= 1) continue;
            profileCount += 1;
        }

        const mergeKey = normalizeMergeKey(asString(raw.mergeKey) || title) || 'theme';
        let sourceId: string;
        if (layer === 'episodic') {
            sourceId = ctx.rootSourceId;
        } else if (layer === 'semantic') {
            sourceId = `theme:${mergeKey}`;
        } else if (layer === 'profile') {
            sourceId = `profile:${mergeKey}`;
        } else {
            sourceId = `${layer}:${mergeKey}:${ctx.rootSourceId}`;
        }

        let eventDate: string | null = null;
        if (raw.eventDate !== undefined && raw.eventDate !== null && raw.eventDate !== '') {
            eventDate = normalizeEventDate(raw.eventDate, writeDay);
            if (!eventDate) {
                console.warn(
                    '[eventDate] Memory atom eventDate unparseable; storing null. raw=',
                    JSON.stringify(raw.eventDate),
                );
            }
        }

        out.push({
            layer,
            source: ctx.source,
            sourceId,
            rootSourceId: ctx.rootSourceId,
            rootSourceKind: ctx.rootSourceKind,
            title: title.slice(0, 80),
            content: content.slice(0, 420),
            tags: asTags(raw.tags),
            salience: clamp01(raw.salience, layer === 'episodic' ? 0.76 : 0.62),
            confidence: clamp01(raw.confidence, 0.78),
            eventDate,
        });
    }

    return out;
}

async function requestExtraction(ctx: MemoryExtractionContext): Promise<LocalMemoryAtomInput[]> {
    if (!ctx.entryText.trim()) return [];

    const writeDay = ctx.now ?? new Date();
    const writeKey = getLocalDateKey(writeDay);

    const { content } = await fetchDirectJsonCompletion(
        {
            model: 'agent-default',
            messages: [
                { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: [
                        `Write day (device local clock for resolving relative dates): ${writeKey}`,
                        `Session kind: ${ctx.sessionKindLabel}`,
                        `Session title: ${ctx.sessionTitle}`,
                        ctx.assistantHints ? `Hints:\n${ctx.assistantHints}` : '',
                        `User writing:\n${ctx.entryText.slice(0, 6000)}`,
                    ]
                        .filter(Boolean)
                        .join('\n\n'),
                },
            ],
            temperature: INSIGHTS_TEMPERATURE,
            max_tokens: 1_024,
        },
        { modelPurpose: 'flash' },
    );

    const parsed = parseExtraction(content);
    if (!parsed?.atoms || !Array.isArray(parsed.atoms)) {
        throw new Error('Memory atom extraction returned no atoms.');
    }

    return toAtomInputs(ctx, parsed.atoms, writeDay);
}

/** Public for tests / optional direct use. Soft-fails to []. */
export async function extractMemoryAtoms(
    ctx: MemoryExtractionContext
): Promise<LocalMemoryAtomInput[]> {
    try {
        return await requestExtraction(ctx);
    } catch (error) {
        console.warn('AI memory extraction failed:', error);
        return [];
    }
}

export async function extractJournalMemoryAtoms(
    entry: JournalEntry
): Promise<LocalMemoryAtomInput[]> {
    const entryText = userTranscript(entry.messages) || entry.title;
    const analysis = entry.analysis;
    const hints = analysis
        ? [
            analysis.insight ? `Insight: ${analysis.insight}` : '',
            analysis.mood ? `Mood: ${analysis.mood}` : '',
            analysis.topics?.length ? `Topics: ${analysis.topics.join(', ')}` : '',
        ]
            .filter(Boolean)
            .join('\n')
        : undefined;

    return extractMemoryAtoms({
        source: 'journal',
        rootSourceId: entry.id,
        rootSourceKind: 'journal_entry',
        sessionTitle: entry.title,
        sessionKindLabel: 'journal entry',
        entryText,
        assistantHints: hints,
    });
}

export async function extractCheckInMemoryAtoms(
    checkIn: IntentionCheckIn
): Promise<LocalMemoryAtomInput[]> {
    const entryText =
        userTranscript(checkIn.messages) || checkIn.summary || checkIn.title;
    const kind =
        checkIn.type === 'morning'
            ? 'morning intention'
            : checkIn.type === 'evening'
                ? 'evening reflection'
                : 'intention setting';

    return extractMemoryAtoms({
        source: 'intention',
        rootSourceId: checkIn.id,
        rootSourceKind: 'intention_checkin',
        sessionTitle: checkIn.title,
        sessionKindLabel: kind,
        entryText,
        assistantHints: checkIn.summary ? `Summary: ${checkIn.summary}` : undefined,
    });
}
