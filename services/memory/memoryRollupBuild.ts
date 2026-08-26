/**
 * Lazy week / month / year rollup builder (Memory v3 Phase 4).
 *
 * Source of truth for week rollups: **@blackrose_day_digests** (legacy day
 * digest store via listDayDigests) — intentional per design ("extend day
 * digests upward"). NOT @rosebud_session_digest:* (session registry is for
 * Phase 3 on-demand recall). Day digests are still written on every Finish:
 * journal → runJournalFinishSideEffects → upsertJournalDayDigest; check-ins →
 * upsertCheckInDayDigest. Session digests are a parallel Finish write.
 *
 * Thresholds:
 *   - week:  ≥ WEEK_MIN_DAY_DIGESTS (3) day digests in a *closed* ISO week
 *   - month: ≥ MONTH_MIN_WEEK_ROLLUPS (2) week rollups in a closed month
 *            (fallback: ≥ MONTH_MIN_DAY_DIGESTS day digests if weeks sparse)
 *   - year:  ≥ YEAR_MIN_MONTH_ROLLUPS (2) month rollups in a closed year
 *
 * Failure / offline: LLM failure does **not** write a rollup. A lightweight
 * last-attempt marker (@rosebud_memory_rollup_attempts) enforces backoff so
 * repeated app opens while offline do not re-fire flash calls for the same
 * period until ROLLUP_RETRY_BACKOFF_MS elapses.
 *
 * Runs on app open via ensureMemoryRollupsUpToDate — not a background timer.
 */

import { accountScopedStorage as AsyncStorage } from '@/services/account/accountScopedStorage';
import { runAccountBoundOperation } from '@/services/account/accountRuntime';
import {
    extractFirstJsonObject,
    fetchDirectJsonCompletion,
} from '@/services/ai/jsonCompletion';
import { INSIGHTS_TEMPERATURE } from '@/services/ai/generationSettings';
import { listDayDigests } from '@/services/memory/dayDigestStorage';
import type { DayDigest } from '@/services/memory/dayDigest.types';
import {
    getMemoryRollup,
    listMemoryRollups,
    memoryRollupId,
    upsertMemoryRollup,
} from '@/services/memory/memoryRollupStorage';
import type { MemoryRollup, MemoryRollupKind } from '@/services/memory/memoryRollup.types';
import {
    formatIsoWeekKey,
    formatMonthKey,
    formatYearKey,
    isPeriodClosed,
    periodKeyForDate,
    windowForPeriod,
} from '@/services/memory/memoryRollupPeriods';
import { parseLocalDateKey } from '@/utils/date';

/** Sparse journaling: 3 active days in a closed week is enough to roll up. */
export const WEEK_MIN_DAY_DIGESTS = 3;
export const MONTH_MIN_WEEK_ROLLUPS = 2;
export const MONTH_MIN_DAY_DIGESTS = 7;
export const YEAR_MIN_MONTH_ROLLUPS = 2;
/** Don't burn many LLM calls on one cold open. */
export const MAX_ROLLUPS_PER_ENSURE = 3;
/** Min time between failed (or incomplete) LLM attempts for the same period. */
export const ROLLUP_RETRY_BACKOFF_MS = 12 * 60 * 60 * 1000;
export const ROLLUP_ATTEMPTS_KEY = '@rosebud_memory_rollup_attempts';

interface RollupAttemptMap {
    schemaVersion: 1;
    /** period id → lastAttemptAt ms */
    attempts: Record<string, number>;
}

let attemptsAdapter: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem?(key: string): Promise<void>;
} = AsyncStorage;

/** Test seam for attempt map (defaults to AsyncStorage). */
export function setRollupAttemptsAdapter(
    adapter: typeof attemptsAdapter,
): void {
    attemptsAdapter = adapter;
}

export function resetRollupAttemptsAdapter(): void {
    attemptsAdapter = AsyncStorage;
}

async function loadAttempts(): Promise<RollupAttemptMap> {
    try {
        const raw = await attemptsAdapter.getItem(ROLLUP_ATTEMPTS_KEY);
        if (!raw) return { schemaVersion: 1, attempts: {} };
        const parsed = JSON.parse(raw) as Partial<RollupAttemptMap>;
        if (!parsed || typeof parsed !== 'object') return { schemaVersion: 1, attempts: {} };
        const attempts: Record<string, number> = {};
        if (parsed.attempts && typeof parsed.attempts === 'object') {
            for (const [k, v] of Object.entries(parsed.attempts)) {
                if (typeof v === 'number' && Number.isFinite(v)) attempts[k] = v;
            }
        }
        return { schemaVersion: 1, attempts };
    } catch {
        return { schemaVersion: 1, attempts: {} };
    }
}

async function markRollupAttempt(periodId: string, now: number): Promise<void> {
    const map = await loadAttempts();
    map.attempts[periodId] = now;
    await attemptsAdapter.setItem(ROLLUP_ATTEMPTS_KEY, JSON.stringify(map));
}

/**
 * True when we should call the LLM for this period.
 * Skips if last attempt was within ROLLUP_RETRY_BACKOFF_MS (offline thrash guard).
 */
export async function canAttemptRollup(
    periodId: string,
    now: number,
): Promise<boolean> {
    const map = await loadAttempts();
    const last = map.attempts[periodId];
    if (last === undefined) return true;
    return now - last >= ROLLUP_RETRY_BACKOFF_MS;
}

/** Clear attempt markers (history clear + tests). */
export async function clearRollupAttempts(): Promise<void> {
    if (attemptsAdapter.removeItem) {
        await attemptsAdapter.removeItem(ROLLUP_ATTEMPTS_KEY);
        return;
    }
    await attemptsAdapter.setItem(ROLLUP_ATTEMPTS_KEY, JSON.stringify({
        schemaVersion: 1,
        attempts: {},
    }));
}

/** @deprecated alias for tests */
export const clearRollupAttemptsForTests = clearRollupAttempts;

const ROLLUP_SYSTEM = `You summarize a set of short journal day digests into one period rollup.

Return ONLY valid JSON:
{
  "summary": string,
  "topics": string[]
}

Rules:
- summary: 2–4 sentences, third person about the user, concrete themes.
- topics: 3–8 short lowercase tags.
- Never invent events not supported by the source lines.
- JSON only.`;

function parseRollupJson(raw: string): { summary: string; topics: string[] } | null {
    const jsonText = extractFirstJsonObject(raw) ?? raw;
    try {
        const parsed = JSON.parse(jsonText) as Record<string, unknown>;
        const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
        if (!summary) return null;
        const topics: string[] = [];
        if (Array.isArray(parsed.topics)) {
            for (const t of parsed.topics) {
                if (typeof t === 'string' && t.trim()) topics.push(t.trim());
            }
        }
        return { summary, topics: topics.slice(0, 10) };
    } catch {
        return null;
    }
}

async function requestRollupSummary(label: string, sourceLines: string[]): Promise<{ summary: string; topics: string[] } | null> {
    try {
        const { content } = await fetchDirectJsonCompletion(
            {
                model: 'agent-default',
                messages: [
                    { role: 'system', content: ROLLUP_SYSTEM },
                    {
                        role: 'user',
                        content: `Period: ${label}\n\nSources:\n${sourceLines.join('\n').slice(0, 5000)}`,
                    },
                ],
                temperature: INSIGHTS_TEMPERATURE,
                max_tokens: 400,
            },
            { modelPurpose: 'flash' },
        );
        return parseRollupJson(content);
    } catch (error) {
        console.warn('Rollup LLM failed:', error);
        return null;
    }
}

function fallbackSummary(label: string, lines: string[]): { summary: string; topics: string[] } {
    const joined = lines.slice(0, 5).join(' · ').slice(0, 400);
    return {
        summary: joined
            ? `${label}: ${joined}`
            : `${label}: journaling activity recorded.`,
        topics: ['journal'],
    };
}

function groupDayDigestsByWeek(days: readonly DayDigest[]): Map<string, DayDigest[]> {
    const map = new Map<string, DayDigest[]>();
    for (const d of days) {
        const date = parseLocalDateKey(d.dateKey);
        if (!date) continue;
        const key = formatIsoWeekKey(date);
        const list = map.get(key) ?? [];
        list.push(d);
        map.set(key, list);
    }
    return map;
}

function groupDayDigestsByMonth(days: readonly DayDigest[]): Map<string, DayDigest[]> {
    const map = new Map<string, DayDigest[]>();
    for (const d of days) {
        const date = parseLocalDateKey(d.dateKey);
        if (!date) continue;
        const key = formatMonthKey(date);
        const list = map.get(key) ?? [];
        list.push(d);
        map.set(key, list);
    }
    return map;
}

async function buildOneRollup(input: {
    kind: MemoryRollupKind;
    periodKey: string;
    sourceLines: string[];
    sourceCount: number;
    now: number;
    /** When true, allow extractive fallback without LLM (tests only). */
    allowFallbackWithoutLlm?: boolean;
}): Promise<MemoryRollup | null> {
    const window = windowForPeriod(input.kind, input.periodKey);
    if (!window) return null;

    const periodId = memoryRollupId(input.kind, input.periodKey);
    // Record attempt *before* the network call so a crash/offline still backs off.
    await markRollupAttempt(periodId, input.now);

    const llm = await requestRollupSummary(
        `${input.kind} ${input.periodKey}`,
        input.sourceLines,
    );
    // No silent permanent extractive write on LLM failure — retry after backoff.
    if (!llm && !input.allowFallbackWithoutLlm) {
        console.warn(`Rollup LLM empty for ${periodId}; will retry after backoff`);
        return null;
    }
    const { summary, topics } = llm
        ?? fallbackSummary(`${input.kind} ${input.periodKey}`, input.sourceLines);

    const existing = await getMemoryRollup(input.kind, input.periodKey);
    const createdAt = existing?.createdAt ?? input.now;

    return upsertMemoryRollup({
        schemaVersion: 1,
        kind: input.kind,
        periodKey: input.periodKey,
        dateFrom: window.dateFrom,
        dateTo: window.dateTo,
        summary,
        topics,
        sourceCount: input.sourceCount,
        createdAt,
        updatedAt: input.now,
    });
}

export interface EnsureRollupsResult {
    created: MemoryRollup[];
    skipped: number;
}

/**
 * Generate missing closed-period rollups up to MAX_ROLLUPS_PER_ENSURE.
 * Safe to fire-and-forget from app open.
 */
async function ensureMemoryRollupsForAccount(
    options: { now?: Date; maxNew?: number; allowFallbackWithoutLlm?: boolean } = {},
): Promise<EnsureRollupsResult> {
    const nowDate = options.now ?? new Date();
    const now = nowDate.getTime();
    const maxNew = options.maxNew ?? MAX_ROLLUPS_PER_ENSURE;
    const created: MemoryRollup[] = [];
    let skipped = 0;

    try {
        // Day digests (@blackrose_day_digests) — still written on every Finish.
        const days = await listDayDigests({ limit: 400 });
        if (days.length === 0) return { created, skipped };

        // --- Weeks from day digests ---
        const byWeek = groupDayDigestsByWeek(days);
        const weekKeys = Array.from(byWeek.keys()).sort();
        for (const periodKey of weekKeys) {
            if (created.length >= maxNew) break;
            const window = windowForPeriod('week', periodKey);
            if (!window || !isPeriodClosed(window.dateTo, nowDate)) {
                skipped += 1;
                continue;
            }
            const sources = byWeek.get(periodKey) ?? [];
            if (sources.length < WEEK_MIN_DAY_DIGESTS) {
                skipped += 1;
                continue;
            }
            const existing = await getMemoryRollup('week', periodKey);
            const newestSource = Math.max(...sources.map((s) => s.updatedAt));
            if (existing && existing.updatedAt >= newestSource) {
                skipped += 1;
                continue;
            }
            const periodId = memoryRollupId('week', periodKey);
            if (!(await canAttemptRollup(periodId, now))) {
                skipped += 1;
                continue;
            }
            const lines = sources.map(
                (s) => `- ${s.dateKey}: ${s.summary}${s.topics.length ? ` [${s.topics.slice(0, 4).join(', ')}]` : ''}`,
            );
            const rollup = await buildOneRollup({
                kind: 'week',
                periodKey,
                sourceLines: lines,
                sourceCount: sources.length,
                now,
                allowFallbackWithoutLlm: options.allowFallbackWithoutLlm,
            });
            if (rollup) created.push(rollup);
        }

        // --- Months from week rollups (fallback: day digests) ---
        const weekRollups = await listMemoryRollups({ kind: 'week' });
        const weeksByMonth = new Map<string, MemoryRollup[]>();
        for (const w of weekRollups) {
            const mid = w.dateFrom;
            const monthKey = periodKeyForDate('month', mid);
            if (!monthKey) continue;
            const list = weeksByMonth.get(monthKey) ?? [];
            list.push(w);
            weeksByMonth.set(monthKey, list);
        }
        const daysByMonth = groupDayDigestsByMonth(days);
        const monthKeys = new Set([...weeksByMonth.keys(), ...daysByMonth.keys()]);

        for (const periodKey of Array.from(monthKeys).sort()) {
            if (created.length >= maxNew) break;
            const window = windowForPeriod('month', periodKey);
            if (!window || !isPeriodClosed(window.dateTo, nowDate)) {
                skipped += 1;
                continue;
            }
            const weeks = weeksByMonth.get(periodKey) ?? [];
            const monthDays = daysByMonth.get(periodKey) ?? [];
            const enoughWeeks = weeks.length >= MONTH_MIN_WEEK_ROLLUPS;
            const enoughDays = monthDays.length >= MONTH_MIN_DAY_DIGESTS;
            if (!enoughWeeks && !enoughDays) {
                skipped += 1;
                continue;
            }
            const existing = await getMemoryRollup('month', periodKey);
            const newestSource = Math.max(
                0,
                ...weeks.map((w) => w.updatedAt),
                ...monthDays.map((d) => d.updatedAt),
            );
            if (existing && existing.updatedAt >= newestSource) {
                skipped += 1;
                continue;
            }
            const periodId = memoryRollupId('month', periodKey);
            if (!(await canAttemptRollup(periodId, now))) {
                skipped += 1;
                continue;
            }
            const lines = enoughWeeks
                ? weeks.map((w) => `- week ${w.periodKey}: ${w.summary}`)
                : monthDays.map((d) => `- ${d.dateKey}: ${d.summary}`);
            const rollup = await buildOneRollup({
                kind: 'month',
                periodKey,
                sourceLines: lines,
                sourceCount: enoughWeeks ? weeks.length : monthDays.length,
                now,
                allowFallbackWithoutLlm: options.allowFallbackWithoutLlm,
            });
            if (rollup) created.push(rollup);
        }

        // --- Years from month rollups ---
        const monthRollups = await listMemoryRollups({ kind: 'month' });
        const monthsByYear = new Map<string, MemoryRollup[]>();
        for (const m of monthRollups) {
            const y = formatYearKey(parseLocalDateKey(m.dateFrom) ?? nowDate);
            const list = monthsByYear.get(y) ?? [];
            list.push(m);
            monthsByYear.set(y, list);
        }

        for (const periodKey of Array.from(monthsByYear.keys()).sort()) {
            if (created.length >= maxNew) break;
            const window = windowForPeriod('year', periodKey);
            if (!window || !isPeriodClosed(window.dateTo, nowDate)) {
                skipped += 1;
                continue;
            }
            const months = monthsByYear.get(periodKey) ?? [];
            if (months.length < YEAR_MIN_MONTH_ROLLUPS) {
                skipped += 1;
                continue;
            }
            const existing = await getMemoryRollup('year', periodKey);
            const newestSource = Math.max(...months.map((m) => m.updatedAt));
            if (existing && existing.updatedAt >= newestSource) {
                skipped += 1;
                continue;
            }
            const periodId = memoryRollupId('year', periodKey);
            if (!(await canAttemptRollup(periodId, now))) {
                skipped += 1;
                continue;
            }
            const lines = months.map((m) => `- ${m.periodKey}: ${m.summary}`);
            const rollup = await buildOneRollup({
                kind: 'year',
                periodKey,
                sourceLines: lines,
                sourceCount: months.length,
                now,
                allowFallbackWithoutLlm: options.allowFallbackWithoutLlm,
            });
            if (rollup) created.push(rollup);
        }
    } catch (error) {
        console.warn('ensureMemoryRollupsUpToDate failed:', error);
    }

    return { created, skipped };
}

export function ensureMemoryRollupsUpToDate(
    options: { now?: Date; maxNew?: number; allowFallbackWithoutLlm?: boolean } = {},
): Promise<EnsureRollupsResult> {
    return runAccountBoundOperation(
        'memory-rollup-build',
        () => ensureMemoryRollupsForAccount(options),
    );
}

/** Fire-and-forget entry for app open. */
export function scheduleMemoryRollupsOnAppOpen(): void {
    void ensureMemoryRollupsUpToDate().catch((err) => {
        console.warn('Memory rollup schedule failed:', err);
    });
}
