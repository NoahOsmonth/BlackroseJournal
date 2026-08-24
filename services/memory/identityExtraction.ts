/**
 * Identity extraction — turn-level and finish-path.
 *
 * Same category of device-direct flash call as memoryAtomExtraction.ts, but
 * scoped to durable identity (name, pronouns, people, hard facts). Soft-fails
 * so chat never blocks on a bad model response.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WRITE AUTHORITY (Memory v3 Phase 1 — do NOT reverse quietly)
 * ─────────────────────────────────────────────────────────────────────────
 * The LLM structured JSON call is the ONLY production write path into
 * @rosebud_identity_profile.
 *
 * Deterministic regex (`extractIdentityDeterministic`) is an OPTIONAL
 * fast pre-filter / signal helper only:
 *   - gate whether a flash call is worth making
 *   - optional hint text for the model
 *   - unit-testable offline name parsing
 * Regex NEVER alone calls applyIdentityPatch in production. If a future
 * agent "optimizes" by writing regex hits without AI confirmation, that
 * reintroduces the class of bugs where valid phrasing is missed OR false
 * positives land in the store. `deterministicOnly` exists solely for
 * tests and explicit offline fixtures — not for scheduleIdentityExtractionFromTurn.
 *
 * On LLM network/parse failure after one retry: do not write (soft-fail null).
 * Finish-path re-runs with forceLlm as the session backstop when online.
 * ─────────────────────────────────────────────────────────────────────────
 */

import {
    extractFirstJsonObject,
    fetchDirectJsonCompletion,
} from '@/services/ai/jsonCompletion';
import { INSIGHTS_TEMPERATURE } from '@/services/ai/generationSettings';
import { runAccountBoundOperation } from '@/services/account/accountRuntime';
import {
    applyIdentityPatch,
    getIdentityProfile,
    patchIsEmpty,
} from './identityProfile';
import type { IdentityPatch, IdentityProfile } from './identityProfile.types';

const EXTRACTION_SYSTEM_PROMPT = `You extract durable IDENTITY facts about the journal user from a short message or transcript.

Return ONLY valid JSON:
{
  "preferredName": string | null,
  "pronouns": string | null,
  "about": string | null,
  "keyPeople": [ { "name": string, "relation": string | null } ],
  "facts": string[],
  "confidence": number
}

Rules:
- Only extract facts the USER states about THEMSELVES or people in their life.
- preferredName: what they want to be called (not other people's names).
- Natural self-intros count: "I am Sigurd", "I'm Alex", "my name is …", "call me …".
- Do NOT treat moods/states as names: "I am tired", "I am fine", "I am stressed" → preferredName null.
- pronouns: only if explicitly stated.
- about: one short clause (job, life stage) if clearly self-describing.
- keyPeople: named people with optional relation (partner, mom, dog, friend).
- facts: durable prefs / constraints (e.g. "night owl", "lives in Oslo") — max 4.
- Ignore moods, one-off events, and session fluff.
- If nothing identity-related, return nulls and empty arrays.
- confidence: 0–1 for the whole patch.
- Never invent. Never copy the assistant's guesses.
- Output JSON only — no markdown fences, no commentary.`;

/** Conjunctions / glue that must never become a second name token. */
const NAME_STOP_WORDS = new Set([
    'and', 'but', 'so', 'or', 'from', 'with', 'who', 'that', 'here', 'today',
    'this', 'just', 'also', 'really', 'very', 'still', 'been', 'have', 'will',
    'tired', 'fine', 'okay', 'good', 'back', 'feeling', 'trying',
]);

const NAME_LEAD_RE =
    /\b(?:my name is|i(?:'m| am) called|call me|i go by|they call me)\s+([A-Za-z][A-Za-z''-]{1,40})(?:\s+([A-Za-z][A-Za-z''-]{1,40}))?/i;

/**
 * Pre-filter only — "I'm Alex," / "I am Alex." / bare "I am Sigurd".
 * Must NOT write to the store by itself (see file header).
 */
const IM_NAME_RE =
    /\b(?:I'm|I am|i'm|i am)\s+([A-Z][a-zA-Z''-]{2,40})\b(?=\s*[,.!?;:\-–—]|$|\s+(?:and|here|btw|today|please|thanks)\b)/;

const PRONOUN_PATTERN =
    /\b(?:my pronouns (?:are|is)|i use)\s+([a-z]{2,12}\s*\/\s*[a-z]{2,12}(?:\s*\/\s*[a-z]{2,12})?)\b/i;

function isPlausibleNameToken(token: string): boolean {
    const t = token.trim();
    if (t.length < 2) return false;
    if (NAME_STOP_WORDS.has(t.toLowerCase())) return false;
    return true;
}

function titleCaseName(token: string): string {
    const t = token.trim();
    if (!t) return t;
    return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Cheap gate: skip flash LLM on pure greetings / empty fluff. */
const IDENTITY_SIGNAL_RE =
    /\b(my name is|i'?m called|call me|i go by|pronouns?|my (?:partner|wife|husband|boyfriend|girlfriend|mom|dad|mother|father|son|daughter|kid|kids|dog|cat|friend|boss|colleague)|i (?:work|live|am a|am an)|i'?m a |i'?m an )\b/i;

/** "I am Sigurd" / "I'm Alex." — capital name after self-intro (complements IDENTITY_SIGNAL_RE). */
const IM_NAME_SIGNAL_RE =
    /\b(?:I'm|I am|i'm|i am)\s+[A-Z][a-zA-Z''-]{2,40}\b/;

const GREETING_ONLY_RE =
    /^(hi|hello|hey|yo|sup|good (?:morning|afternoon|evening)|howdy)[\s!.?]*$/i;

/** Avoid overlapping flash calls on rapid taps. */
let extractInFlight: Promise<IdentityProfile | null> | null = null;
let lastExtractKey = '';
let lastExtractAt = 0;
const EXTRACT_DEBOUNCE_MS = 2_500;
/** Cap retries on malformed JSON (1 retry = 2 total attempts). */
const MAX_LLM_ATTEMPTS = 2;

function asString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const t = value.trim();
    return t.length > 0 ? t : undefined;
}

function clamp01(value: unknown, fallback: number): number {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(1, n));
}

/**
 * Deterministic, offline name / pronoun harvest — PRE-FILTER ONLY.
 * Callers must not treat a non-empty patch as permission to write the store
 * without an AI confirm (except explicit deterministicOnly test fixtures).
 */
export function extractIdentityDeterministic(text: string): IdentityPatch {
    const patch: IdentityPatch = {
        source: 'extraction',
        confidence: 0.9,
        keyPeople: [],
        facts: [],
    };

    const cleaned = text.trim();
    if (!cleaned) return patch;

    const lead = cleaned.match(NAME_LEAD_RE);
    if (lead?.[1] && isPlausibleNameToken(lead[1])) {
        const first = titleCaseName(lead[1]);
        const secondRaw = lead[2]?.trim();
        const second = secondRaw && isPlausibleNameToken(secondRaw)
            ? titleCaseName(secondRaw)
            : undefined;
        if (!NAME_STOP_WORDS.has(first.toLowerCase())) {
            patch.preferredName = second ? `${first} ${second}` : first;
        }
    }

    if (!patch.preferredName) {
        const im = cleaned.match(IM_NAME_RE);
        if (im?.[1] && isPlausibleNameToken(im[1])) {
            patch.preferredName = titleCaseName(im[1]);
        }
    }

    const pronouns = cleaned.match(PRONOUN_PATTERN);
    if (pronouns?.[1]) {
        patch.pronouns = pronouns[1].replace(/\s+/g, '').toLowerCase().replace(/\//g, ' / ');
    }

    return patch;
}

export function looksLikeIdentitySignal(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed || GREETING_ONLY_RE.test(trimmed)) return false;
    if (IDENTITY_SIGNAL_RE.test(trimmed)) return true;
    if (IM_NAME_SIGNAL_RE.test(trimmed)) return true;
    // Long personal rants may still hold people even without an explicit name phrase.
    if (trimmed.length >= 100 && /\b(?:my|i|i'm|i am)\b/i.test(trimmed)) return true;
    return false;
}

function parseExtraction(raw: string): IdentityPatch | null {
    const jsonText = extractFirstJsonObject(raw) ?? raw;
    try {
        const parsed = JSON.parse(jsonText) as Record<string, unknown>;
        // Schema guard: require an object with at least one known key shape.
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            return null;
        }
        const keyPeople: { name: string; relation?: string }[] = [];
        if (Array.isArray(parsed.keyPeople)) {
            for (const item of parsed.keyPeople) {
                if (typeof item !== 'object' || item === null) continue;
                const row = item as Record<string, unknown>;
                const name = asString(row.name);
                if (!name) continue;
                const relation = asString(row.relation) ?? undefined;
                keyPeople.push({ name, relation });
            }
        }
        const facts: string[] = [];
        if (Array.isArray(parsed.facts)) {
            for (const item of parsed.facts) {
                const fact = asString(item);
                if (fact) facts.push(fact);
            }
        }
        return {
            preferredName: asString(parsed.preferredName) ?? undefined,
            pronouns: asString(parsed.pronouns) ?? undefined,
            about: asString(parsed.about) ?? undefined,
            keyPeople: keyPeople.slice(0, 6),
            facts: facts.slice(0, 4),
            confidence: clamp01(parsed.confidence, 0.72),
            source: 'extraction',
        };
    } catch {
        return null;
    }
}

function buildUserExtractContent(userText: string, prefilter: IdentityPatch): string {
    const lines = [
        `User writing (extract identity only):\n${userText.slice(0, 4000)}`,
    ];
    // Optional hints — model must still confirm from user text; never trust alone.
    if (!patchIsEmpty(prefilter)) {
        const hints: string[] = [];
        if (prefilter.preferredName) hints.push(`preferredName?: ${prefilter.preferredName}`);
        if (prefilter.pronouns) hints.push(`pronouns?: ${prefilter.pronouns}`);
        if (hints.length > 0) {
            lines.push(
                `Pre-filter regex hints (may be wrong; confirm or reject from user text only): ${hints.join('; ')}`,
            );
        }
    }
    return lines.join('\n\n');
}

async function requestLlmIdentityPatchOnce(
    userText: string,
    prefilter: IdentityPatch,
): Promise<{ patch: IdentityPatch | null; raw: string; httpOk: boolean }> {
    // Shared helper: structured json_object first, freeform retry if model rejects it.
    const { content } = await fetchDirectJsonCompletion(
        {
            model: 'agent-default',
            messages: [
                { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: buildUserExtractContent(userText, prefilter),
                },
            ],
            temperature: INSIGHTS_TEMPERATURE,
            max_tokens: 512,
        },
        { modelPurpose: 'flash' },
    );
    return { patch: parseExtraction(content), raw: content, httpOk: true };
}

/**
 * Structured LLM extract with one retry on malformed / unparseable JSON.
 * Does not fall back to regex writes.
 */
async function requestLlmIdentityPatch(
    userText: string,
    prefilter: IdentityPatch,
): Promise<IdentityPatch | null> {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_LLM_ATTEMPTS; attempt += 1) {
        try {
            const { patch } = await requestLlmIdentityPatchOnce(userText, prefilter);
            if (patch) return patch;
            // Malformed or empty schema — retry once, then give up (no regex write).
            lastError = new Error('Identity extraction returned unparseable or invalid JSON');
        } catch (error) {
            lastError = error;
        }
    }
    if (lastError) {
        console.warn('Identity LLM extraction failed after retries:', lastError);
    }
    return null;
}

export interface ExtractIdentityOptions {
    /** Force flash LLM even without signals (e.g. finish path). */
    forceLlm?: boolean;
    /**
     * TEST / fixture only: apply deterministic pre-filter without LLM.
     * Production chat paths must never set this — see file header.
     */
    deterministicOnly?: boolean;
}

/**
 * Extract + apply identity from user text. Soft-fails to null.
 * Safe to fire-and-forget from the chat send path.
 *
 * Production: writes only after a successful AI structured extract.
 */
async function extractAndApplyIdentityForAccount(
    userText: string,
    options: ExtractIdentityOptions = {},
): Promise<IdentityProfile | null> {
    const trimmed = userText.trim();
    if (!trimmed || GREETING_ONLY_RE.test(trimmed)) return null;

    const now = Date.now();
    const key = trimmed.slice(0, 200);
    if (
        !options.forceLlm
        && key === lastExtractKey
        && now - lastExtractAt < EXTRACT_DEBOUNCE_MS
    ) {
        return null;
    }

    if (extractInFlight) {
        try {
            await extractInFlight;
        } catch {
            // prior failure ignored
        }
    }

    const run = (async (): Promise<IdentityProfile | null> => {
        try {
            // Pre-filter only — never the sole write authority in production.
            const prefilter = extractIdentityDeterministic(trimmed);

            // Explicit test escape hatch (documented): regex write allowed only here.
            if (options.deterministicOnly) {
                if (patchIsEmpty(prefilter)) return null;
                lastExtractKey = key;
                lastExtractAt = Date.now();
                return applyIdentityPatch(prefilter);
            }

            const shouldLlm = options.forceLlm
                || looksLikeIdentitySignal(trimmed)
                || !patchIsEmpty(prefilter);

            if (!shouldLlm) return null;

            const llmPatch = await requestLlmIdentityPatch(trimmed, prefilter);
            // AI is the sole write path. Pre-filter never merges into the store alone.
            if (!llmPatch || patchIsEmpty(llmPatch)) return null;

            lastExtractKey = key;
            lastExtractAt = Date.now();
            return applyIdentityPatch(llmPatch);
        } catch (error) {
            console.warn('Identity extraction failed:', error);
            return null;
        }
    })();

    extractInFlight = run;
    try {
        return await run;
    } finally {
        if (extractInFlight === run) extractInFlight = null;
    }
}

export function extractAndApplyIdentity(
    userText: string,
    options: ExtractIdentityOptions = {},
): Promise<IdentityProfile | null> {
    return runAccountBoundOperation(
        'identity-extraction',
        () => extractAndApplyIdentityForAccount(userText, options),
    );
}

/**
 * Turn-level entry point: non-blocking for callers that don't await.
 * Uses signals so pure "hi" does not burn a flash call; identity lines always run AI.
 * Never uses deterministicOnly — production turn path is AI-only writes.
 */
export function scheduleIdentityExtractionFromTurn(userText: string): void {
    const trimmed = userText.trim();
    if (!trimmed || GREETING_ONLY_RE.test(trimmed)) return;
    if (!looksLikeIdentitySignal(trimmed) && trimmed.length < 80) return;
    void extractAndApplyIdentity(trimmed).catch(() => undefined);
}

/** Finish path: force full AI extract over the session user transcript. */
export async function extractIdentityFromSessionTranscript(
    userMessages: readonly string[],
): Promise<IdentityProfile | null> {
    const blob = userMessages.map((m) => m.trim()).filter(Boolean).join('\n\n');
    if (!blob) return null;
    return extractAndApplyIdentity(blob, { forceLlm: true });
}

/** Test helper — reset debounce / in-flight gates. */
export function resetIdentityExtractionStateForTests(): void {
    extractInFlight = null;
    lastExtractKey = '';
    lastExtractAt = 0;
}

export async function getIdentitySnapshot(): Promise<IdentityProfile> {
    return getIdentityProfile();
}
