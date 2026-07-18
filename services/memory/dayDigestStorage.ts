/**
 * Day digests — calendar-day rollups of completed journal entries and check-ins.
 * Extractive summaries keep this offline and free; LLM polish is optional later.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { JournalEntry } from '@/services/journal/journalStorage.types';
import type { IntentionCheckIn } from '@/services/intentions/intentionsStorage.types';
import { getLocalDateKeyFromTimestamp } from '@/utils/date';
import type {
    DayDigest,
    DayDigestEnvelope,
    DayDigestListOptions,
    DayDigestPromptOptions,
    DayDigestSource,
    DayDigestStorageAdapter,
} from './dayDigest.types';

export const DAY_DIGEST_STORAGE_KEY = '@blackrose_day_digests';
export const DAY_DIGEST_CORRUPT_BACKUP_KEY = '@blackrose_day_digests_corrupt';
export const DAY_DIGEST_SCHEMA_VERSION = 1;

const MAX_SUMMARY_CHARS = 400;
const MAX_TOPICS = 8;
const MAX_SOURCES = 20;
const MAX_RECENT_CONTEXT_DAYS = 5;
const MAX_CONTEXT_CHARS = 900;

let storageAdapter: DayDigestStorageAdapter = AsyncStorage;

export function setDayDigestStorageAdapter(adapter: DayDigestStorageAdapter): void {
    storageAdapter = adapter;
}

export function resetDayDigestStorageAdapter(): void {
    storageAdapter = AsyncStorage;
}

let writeQueue: Promise<unknown> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
    const run = writeQueue.then(task, task);
    writeQueue = run.catch(() => undefined);
    return run;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function trimText(value: string, maxLength: number): string {
    const clean = value.trim().replace(/\s+/g, ' ');
    return clean.length > maxLength ? `${clean.slice(0, maxLength).trim()}...` : clean;
}

function uniqueStrings(values: readonly string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const value of values) {
        const key = value.trim();
        if (!key) continue;
        const lower = key.toLowerCase();
        if (seen.has(lower)) continue;
        seen.add(lower);
        out.push(key);
    }
    return out;
}

function isValidSource(value: unknown): value is DayDigestSource {
    if (!isRecord(value)) return false;
    if (value.kind !== 'journal_entry' && value.kind !== 'intention_checkin') return false;
    if (typeof value.id !== 'string' || !value.id) return false;
    if (typeof value.title !== 'string') return false;
    if (value.mode !== undefined && typeof value.mode !== 'string') return false;
    return true;
}

function isValidDigest(value: unknown): value is DayDigest {
    if (!isRecord(value)) return false;
    if (typeof value.dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.dateKey)) return false;
    if (typeof value.summary !== 'string') return false;
    if (!Array.isArray(value.topics)) return false;
    if (!Array.isArray(value.sources)) return false;
    if (typeof value.entryCount !== 'number' || !Number.isFinite(value.entryCount)) return false;
    if (typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt)) return false;
    return value.sources.every(isValidSource);
}

function emptyEnvelope(): DayDigestEnvelope {
    return { schemaVersion: DAY_DIGEST_SCHEMA_VERSION, days: {} };
}

async function loadEnvelope(): Promise<DayDigestEnvelope> {
    try {
        const json = await storageAdapter.getItem(DAY_DIGEST_STORAGE_KEY);
        if (!json) return emptyEnvelope();
        let parsed: unknown;
        try {
            parsed = JSON.parse(json);
        } catch {
            await storageAdapter.setItem(DAY_DIGEST_CORRUPT_BACKUP_KEY, json);
            await storageAdapter.removeItem(DAY_DIGEST_STORAGE_KEY);
            return emptyEnvelope();
        }
        if (!isRecord(parsed) || !isRecord(parsed.days)) return emptyEnvelope();
        const days: Record<string, DayDigest> = {};
        Object.entries(parsed.days).forEach(([key, candidate]) => {
            if (isValidDigest(candidate)) {
                days[key] = {
                    ...candidate,
                    topics: candidate.topics.filter((t): t is string => typeof t === 'string').slice(0, MAX_TOPICS),
                    sources: candidate.sources.slice(0, MAX_SOURCES),
                    summary: trimText(candidate.summary, MAX_SUMMARY_CHARS),
                };
            }
        });
        return { schemaVersion: DAY_DIGEST_SCHEMA_VERSION, days };
    } catch {
        return emptyEnvelope();
    }
}

async function saveEnvelope(envelope: DayDigestEnvelope): Promise<void> {
    await storageAdapter.setItem(
        DAY_DIGEST_STORAGE_KEY,
        JSON.stringify({
            schemaVersion: DAY_DIGEST_SCHEMA_VERSION,
            days: envelope.days,
        })
    );
}

function extractUserSnippet(messages: readonly { role?: string; content?: string }[] | undefined): string {
    if (!messages?.length) return '';
    return messages
        .filter((m) => m.role === 'user' && typeof m.content === 'string')
        .map((m) => m.content as string)
        .join(' ')
        .trim();
}

function buildDigestSummary(
    sources: readonly DayDigestSource[],
    topics: readonly string[],
    snippet: string
): string {
    const titles = sources.map((s) => s.title).filter(Boolean).slice(0, 6);
    const parts = [
        titles.length > 0 ? `Sessions: ${titles.join('; ')}.` : 'No titled sessions.',
        snippet ? `Latest notes: ${trimText(snippet, 160)}` : '',
        topics.length > 0 ? `Topics: ${topics.slice(0, 5).join(', ')}.` : '',
    ];
    return trimText(parts.filter(Boolean).join(' '), MAX_SUMMARY_CHARS);
}

function upsertSource(digest: DayDigest, source: DayDigestSource, snippet: string, topics: string[]): DayDigest {
    const without = digest.sources.filter((s) => !(s.kind === source.kind && s.id === source.id));
    const sources = [source, ...without].slice(0, MAX_SOURCES);
    const mergedTopics = uniqueStrings([...topics, ...digest.topics]).slice(0, MAX_TOPICS);

    return {
        ...digest,
        sources,
        topics: mergedTopics,
        entryCount: sources.length,
        summary: buildDigestSummary(sources, mergedTopics, snippet),
        updatedAt: Date.now(),
        schemaNote: 'extractive',
    };
}

function emptyDigest(dateKey: string): DayDigest {
    return {
        dateKey,
        summary: '',
        topics: [],
        sources: [],
        entryCount: 0,
        updatedAt: Date.now(),
        schemaNote: 'extractive',
    };
}

export async function getDayDigest(dateKey: string): Promise<DayDigest | null> {
    const envelope = await loadEnvelope();
    return envelope.days[dateKey] ?? null;
}

export async function listDayDigests(options: DayDigestListOptions = {}): Promise<DayDigest[]> {
    const envelope = await loadEnvelope();
    let list = Object.values(envelope.days);
    if (options.from) {
        list = list.filter((d) => d.dateKey >= options.from!);
    }
    if (options.to) {
        list = list.filter((d) => d.dateKey <= options.to!);
    }
    const order = options.order === 'oldest' ? 'oldest' : 'newest';
    if (order === 'oldest') {
        list.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    } else {
        list.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    }
    if (options.limit !== undefined) {
        list = list.slice(0, Math.max(0, options.limit));
    }
    return list;
}

export async function upsertJournalDayDigest(entry: JournalEntry): Promise<DayDigest | null> {
    if (entry.status !== 'completed') return null;
    const dateKey = getLocalDateKeyFromTimestamp(entry.createdAt);
    const topics = entry.analysis?.topics ?? [];
    const snippet = entry.analysis?.insight
        || extractUserSnippet(entry.messages);
    const source: DayDigestSource = {
        kind: 'journal_entry',
        id: entry.id,
        title: entry.title || 'Journal entry',
        mode: 'journal',
    };

    return withLock(async () => {
        const envelope = await loadEnvelope();
        const existing = envelope.days[dateKey] ?? emptyDigest(dateKey);
        const next = upsertSource(existing, source, snippet, topics);
        envelope.days[dateKey] = next;
        await saveEnvelope(envelope);
        return next;
    });
}

export async function upsertCheckInDayDigest(checkIn: IntentionCheckIn): Promise<DayDigest | null> {
    if (checkIn.status !== 'completed') return null;
    const dateKey = getLocalDateKeyFromTimestamp(checkIn.createdAt);
    const snippet = checkIn.summary || extractUserSnippet(checkIn.messages);
    const topics = [checkIn.type].filter(Boolean);
    const source: DayDigestSource = {
        kind: 'intention_checkin',
        id: checkIn.id,
        title: checkIn.title || `${checkIn.type} check-in`,
        mode: checkIn.type,
    };

    return withLock(async () => {
        const envelope = await loadEnvelope();
        const existing = envelope.days[dateKey] ?? emptyDigest(dateKey);
        const next = upsertSource(existing, source, snippet, topics);
        envelope.days[dateKey] = next;
        await saveEnvelope(envelope);
        return next;
    });
}

export async function clearDayDigests(): Promise<void> {
    await withLock(async () => {
        await storageAdapter.removeItem(DAY_DIGEST_STORAGE_KEY);
    });
}

export async function buildRecentDaysContext(
    options: DayDigestPromptOptions = {}
): Promise<string | undefined> {
    const limit = Math.min(options.days ?? 3, MAX_RECENT_CONTEXT_DAYS);
    const digests = await listDayDigests({ limit });
    if (digests.length === 0) return undefined;

    const header = [
        '## Recent day digests',
        'Summaries of recent journaling days on this device. Prefer these for "what did I talk about" questions; call tools for full transcripts.',
        'Each "Written YYYY-MM-DD" is the calendar day entries were finished — not the day of events named in the prose.',
    ];
    const lines: string[] = [];
    let used = 0;
    for (const digest of digests.slice(0, limit)) {
        const topics = digest.topics.length ? ` [${digest.topics.slice(0, 4).join(', ')}]` : '';
        const line = `- Written ${digest.dateKey}: ${trimText(digest.summary, 220)}${topics}`;
        if (used + line.length > MAX_CONTEXT_CHARS && lines.length > 0) break;
        lines.push(line);
        used += line.length;
    }
    if (lines.length === 0) return undefined;
    return [...header, ...lines].join('\n');
}

export function formatDayDigestForTool(digest: DayDigest): string {
    const sources = digest.sources
        .map((s) => `  - ${s.kind} id=${s.id} title="${s.title}"${s.mode ? ` mode=${s.mode}` : ''}`)
        .join('\n');
    return [
        `writtenDate: ${digest.dateKey} (day entries were finished, not event day in prose)`,
        `summary: ${digest.summary}`,
        `topics: ${digest.topics.join(', ') || '(none)'}`,
        `sessions (${digest.entryCount}):`,
        sources || '  (none)',
    ].join('\n');
}
