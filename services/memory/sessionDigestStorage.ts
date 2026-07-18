/**
 * Session digest registry — sharded AsyncStorage.
 *
 * Keys (this module owns them exclusively):
 *   @rosebud_session_digest_index          lightweight index (ids + dates, no vectors)
 *   @rosebud_session_digest:<sessionId>    full row including embedding[]
 *
 * Why shard: 2048-d nvidia embeddings are ~16–25KB JSON each. A single growing
 * blob hits Android's ~2MB per-key ceiling around ~100 digests. One key per
 * digest keeps each write well under the per-key limit; aggregate size is
 * governed by AsyncStorage_db_size_in_MB (android/gradle.properties).
 *
 * All mutations go through withSessionDigestLock (read-modify-write of index
 * + record is serialized). JSON.parse is always try/catch with safe defaults.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
    SessionDigest,
    SessionDigestIndex,
    SessionDigestIndexEntry,
    SessionDigestListOptions,
    SessionDigestSourceKind,
    SessionDigestStorageAdapter,
} from './sessionDigest.types';

export const SESSION_DIGEST_INDEX_KEY = '@rosebud_session_digest_index';
export const SESSION_DIGEST_KEY_PREFIX = '@rosebud_session_digest:';
export const SESSION_DIGEST_SCHEMA_VERSION = 1;

/** Logical backup key — runtime stays sharded; backup packs into one item. */
export const SESSION_DIGEST_BACKUP_BUNDLE_KEY = '@rosebud_session_digests_bundle';

const MAX_SUMMARY_CHARS = 400;
const MAX_TOPICS = 8;
const MAX_TOPIC_CHARS = 48;

let storageAdapter: SessionDigestStorageAdapter = AsyncStorage;

export function setSessionDigestStorageAdapter(adapter: SessionDigestStorageAdapter): void {
    storageAdapter = adapter;
}

export function resetSessionDigestStorageAdapter(): void {
    storageAdapter = AsyncStorage;
}

let writeQueue: Promise<unknown> = Promise.resolve();

function withSessionDigestLock<T>(task: () => Promise<T>): Promise<T> {
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

export function sessionDigestRecordKey(sessionId: string): string {
    return `${SESSION_DIGEST_KEY_PREFIX}${sessionId}`;
}

function emptyIndex(): SessionDigestIndex {
    return { schemaVersion: SESSION_DIGEST_SCHEMA_VERSION, entries: [] };
}

function isValidSourceKind(value: unknown): value is SessionDigestSourceKind {
    return value === 'journal_entry' || value === 'intention_checkin';
}

function sanitizeIndexEntry(value: unknown): SessionDigestIndexEntry | null {
    if (!isRecord(value)) return null;
    if (typeof value.id !== 'string' || !value.id.trim()) return null;
    if (typeof value.dateISO !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.dateISO)) return null;
    if (typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt)) return null;
    if (!isValidSourceKind(value.sourceKind)) return null;
    if (typeof value.sourceId !== 'string' || !value.sourceId.trim()) return null;
    return {
        id: value.id.trim(),
        dateISO: value.dateISO,
        createdAt: value.createdAt,
        sourceKind: value.sourceKind,
        sourceId: value.sourceId.trim(),
    };
}

function sanitizeDigest(value: unknown): SessionDigest | null {
    if (!isRecord(value)) return null;
    if (typeof value.sessionId !== 'string' || !value.sessionId.trim()) return null;
    if (typeof value.dateISO !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.dateISO)) return null;
    if (typeof value.oneLineSummary !== 'string') return null;
    if (!Array.isArray(value.topics)) return null;
    if (!Array.isArray(value.embedding)) return null;
    if (typeof value.entryWordCount !== 'number' || !Number.isFinite(value.entryWordCount)) return null;
    if (typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt)) return null;
    if (!isValidSourceKind(value.sourceKind)) return null;
    if (typeof value.sourceId !== 'string' || !value.sourceId.trim()) return null;

    const embedding: number[] = [];
    for (const n of value.embedding) {
        if (typeof n !== 'number' || !Number.isFinite(n)) continue;
        embedding.push(n);
    }

    const topics = value.topics
        .filter((t): t is string => typeof t === 'string')
        .map((t) => trimText(t, MAX_TOPIC_CHARS))
        .filter(Boolean)
        .slice(0, MAX_TOPICS);

    const eventDate = typeof value.eventDate === 'string'
        && /^\d{4}-\d{2}-\d{2}$/.test(value.eventDate)
        ? value.eventDate
        : value.eventDate === null
            ? null
            : undefined;

    return {
        schemaVersion: SESSION_DIGEST_SCHEMA_VERSION,
        sessionId: value.sessionId.trim(),
        dateISO: value.dateISO,
        oneLineSummary: trimText(value.oneLineSummary, MAX_SUMMARY_CHARS),
        topics,
        ...(eventDate !== undefined ? { eventDate } : {}),
        embedding,
        entryWordCount: Math.max(0, Math.floor(value.entryWordCount)),
        createdAt: value.createdAt,
        sourceKind: value.sourceKind,
        sourceId: value.sourceId.trim(),
    };
}

async function loadIndexUnlocked(): Promise<SessionDigestIndex> {
    try {
        const json = await storageAdapter.getItem(SESSION_DIGEST_INDEX_KEY);
        if (!json) return emptyIndex();
        let parsed: unknown;
        try {
            parsed = JSON.parse(json);
        } catch {
            return emptyIndex();
        }
        if (!isRecord(parsed)) return emptyIndex();
        const entries: SessionDigestIndexEntry[] = [];
        if (Array.isArray(parsed.entries)) {
            for (const row of parsed.entries) {
                const entry = sanitizeIndexEntry(row);
                if (entry) entries.push(entry);
            }
        }
        return { schemaVersion: SESSION_DIGEST_SCHEMA_VERSION, entries };
    } catch {
        return emptyIndex();
    }
}

async function saveIndexUnlocked(index: SessionDigestIndex): Promise<void> {
    await storageAdapter.setItem(
        SESSION_DIGEST_INDEX_KEY,
        JSON.stringify({
            schemaVersion: SESSION_DIGEST_SCHEMA_VERSION,
            entries: index.entries,
        }),
    );
}

async function loadRecordUnlocked(sessionId: string): Promise<SessionDigest | null> {
    try {
        const json = await storageAdapter.getItem(sessionDigestRecordKey(sessionId));
        if (!json) return null;
        let parsed: unknown;
        try {
            parsed = JSON.parse(json);
        } catch {
            return null;
        }
        return sanitizeDigest(parsed);
    } catch {
        return null;
    }
}

async function multiGetValues(keys: readonly string[]): Promise<Map<string, string | null>> {
    const out = new Map<string, string | null>();
    if (keys.length === 0) return out;
    if (storageAdapter.multiGet) {
        const pairs = await storageAdapter.multiGet(keys);
        for (const [k, v] of pairs) out.set(k, v);
        return out;
    }
    await Promise.all(keys.map(async (key) => {
        out.set(key, await storageAdapter.getItem(key));
    }));
    return out;
}

async function multiRemoveKeys(keys: readonly string[]): Promise<void> {
    if (keys.length === 0) return;
    if (storageAdapter.multiRemove) {
        await storageAdapter.multiRemove(keys);
        return;
    }
    await Promise.all(keys.map((key) => storageAdapter.removeItem(key)));
}

/**
 * Upsert one session digest (record key + index row). Serialized.
 * Replaces any prior row with the same sessionId.
 */
export async function upsertSessionDigest(digest: SessionDigest): Promise<SessionDigest> {
    const clean = sanitizeDigest(digest);
    if (!clean) {
        throw new Error('Invalid session digest');
    }

    return withSessionDigestLock(async () => {
        const index = await loadIndexUnlocked();
        const without = index.entries.filter((e) => e.id !== clean.sessionId);
        const entry: SessionDigestIndexEntry = {
            id: clean.sessionId,
            dateISO: clean.dateISO,
            createdAt: clean.createdAt,
            sourceKind: clean.sourceKind,
            sourceId: clean.sourceId,
        };
        without.push(entry);
        // Newest first for cheap "recent" scans.
        without.sort((a, b) => b.createdAt - a.createdAt);

        await storageAdapter.setItem(
            sessionDigestRecordKey(clean.sessionId),
            JSON.stringify(clean),
        );
        await saveIndexUnlocked({ schemaVersion: SESSION_DIGEST_SCHEMA_VERSION, entries: without });
        return clean;
    });
}

export async function getSessionDigest(sessionId: string): Promise<SessionDigest | null> {
    return loadRecordUnlocked(sessionId);
}

export async function listSessionDigestIndex(
    options: SessionDigestListOptions = {},
): Promise<SessionDigestIndexEntry[]> {
    const index = await loadIndexUnlocked();
    let entries = index.entries;
    if (options.from) {
        entries = entries.filter((e) => e.dateISO >= options.from!);
    }
    if (options.to) {
        entries = entries.filter((e) => e.dateISO <= options.to!);
    }
    if (options.limit !== undefined && options.limit >= 0) {
        entries = entries.slice(0, options.limit);
    }
    return entries;
}

/** Load full digests for index rows (date filter optional). */
export async function listSessionDigests(
    options: SessionDigestListOptions = {},
): Promise<SessionDigest[]> {
    const entries = await listSessionDigestIndex(options);
    if (entries.length === 0) return [];
    const keys = entries.map((e) => sessionDigestRecordKey(e.id));
    const map = await multiGetValues(keys);
    const out: SessionDigest[] = [];
    for (const entry of entries) {
        const json = map.get(sessionDigestRecordKey(entry.id));
        if (!json) continue;
        try {
            const digest = sanitizeDigest(JSON.parse(json));
            if (digest) out.push(digest);
        } catch {
            // skip corrupt row
        }
    }
    return out;
}

export async function clearSessionDigests(): Promise<void> {
    await withSessionDigestLock(async () => {
        const index = await loadIndexUnlocked();
        const keys = [
            SESSION_DIGEST_INDEX_KEY,
            ...index.entries.map((e) => sessionDigestRecordKey(e.id)),
        ];
        await multiRemoveKeys(keys);
        // If index was empty but orphans exist, best-effort prefix wipe when getAllKeys available.
        if (storageAdapter.getAllKeys) {
            try {
                const all = await storageAdapter.getAllKeys();
                const orphans = all.filter(
                    (k) => k.startsWith(SESSION_DIGEST_KEY_PREFIX) || k === SESSION_DIGEST_INDEX_KEY,
                );
                await multiRemoveKeys(orphans);
            } catch {
                // ignore
            }
        }
    });
}

/**
 * Pack all digests into one JSON string for local backup (runtime stays sharded).
 */
export async function exportSessionDigestsBundle(): Promise<string | null> {
    const index = await loadIndexUnlocked();
    if (index.entries.length === 0) {
        const raw = await storageAdapter.getItem(SESSION_DIGEST_INDEX_KEY);
        if (!raw) return null;
    }
    const digests = await listSessionDigests();
    return JSON.stringify({
        schemaVersion: SESSION_DIGEST_SCHEMA_VERSION,
        index,
        digests,
    });
}

/**
 * Restore from a backup bundle: clear shards, rewrite index + records.
 */
export async function importSessionDigestsBundle(json: string | null): Promise<void> {
    await withSessionDigestLock(async () => {
        // Clear existing
        const existing = await loadIndexUnlocked();
        await multiRemoveKeys([
            SESSION_DIGEST_INDEX_KEY,
            ...existing.entries.map((e) => sessionDigestRecordKey(e.id)),
        ]);

        if (!json) return;

        let parsed: unknown;
        try {
            parsed = JSON.parse(json);
        } catch {
            return;
        }
        if (!isRecord(parsed) || !Array.isArray(parsed.digests)) return;

        const digests: SessionDigest[] = [];
        for (const row of parsed.digests) {
            const d = sanitizeDigest(row);
            if (d) digests.push(d);
        }

        const entries: SessionDigestIndexEntry[] = digests
            .map((d) => ({
                id: d.sessionId,
                dateISO: d.dateISO,
                createdAt: d.createdAt,
                sourceKind: d.sourceKind,
                sourceId: d.sourceId,
            }))
            .sort((a, b) => b.createdAt - a.createdAt);

        for (const d of digests) {
            await storageAdapter.setItem(sessionDigestRecordKey(d.sessionId), JSON.stringify(d));
        }
        await saveIndexUnlocked({ schemaVersion: SESSION_DIGEST_SCHEMA_VERSION, entries });
    });
}
