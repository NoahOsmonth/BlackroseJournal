/**
 * Journal Storage Service
 * Handles local-only persistence of journal entries using AsyncStorage.
 * Designed with dependency injection for testability.
 *
 * Storage is SHARDED — the same doctrine as the memory atom store and session
 * digests. A single growing JSON blob hit Android's ~2MB per-key ceiling: a
 * completed entry measures ~3KB, so ~693 entries overflowed `@journal_entries`
 * and the write failed outright. Entries now live one key per hash bucket and
 * `@journal_entries` holds only a lightweight index of summaries
 * (id/title/emoji/status/dates/origin) — never message bodies.
 *
 * Keys (this module owns them exclusively):
 *   @journal_entries                  lightweight index (summaries). Also the
 *                                     pre-shard single-value payload, which is
 *                                     migrated in place on first load.
 *   @journal_entries_shard:<0..15>    entry bodies, bucketed by id hash.
 *
 * schemaVersion 2 = sharded. A v1 payload (a raw `{id: entry}` map at
 * `@journal_entries` with no `shardCount` header) is folded in on first load
 * and rewritten as shards + index. The rewrite is idempotent: the `shardCount`
 * header distinguishes the index from the v1 map, so a second pass is a no-op.
 * Shards are written before the index, so an interrupted migration still leaves
 * the full v1 payload readable until the index write lands.
 *
 * All mutations go through one serialized queue (withMutationLock). Every
 * JSON.parse of a stored payload is inside try/catch with a safe default.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    JournalEntry,
    JournalEntryCreateInput,
    JournalEntrySummary,
    JournalEntryUpdateInput,
    StorageAdapter,
} from './journalStorage.types';
import {
    AccountStorageAdapter,
    claimLegacyStorageKey,
    createAccountScopedStorageAdapter,
} from '@/services/account/accountScopedStorage';
import {
    AccountOperationContext,
    assertAccountOperationActive,
    registerAccountTeardown,
    runAccountBoundOperation,
} from '@/services/account/accountRuntime';

export const JOURNAL_ENTRIES_STORAGE_KEY = '@journal_entries';
export const JOURNAL_ENTRIES_SHARD_KEY_PREFIX = '@journal_entries_shard:';
export const JOURNAL_ENTRIES_SCHEMA_VERSION = 2;
/**
 * 16 buckets: at the measured ~3KB/entry a single shard holds ~170KB at 900
 * entries and reaches the ~2MB per-key ceiling near ~11,000 entries — roughly
 * 16x the ~693-entry ceiling of the single-key store. A larger count would push
 * the ceiling further but add reads to every full list; the index itself stays
 * under 2MB past ~13,000 entries, so 16 keeps both bounds clear for years of
 * daily journaling.
 */
export const JOURNAL_ENTRIES_SHARD_COUNT = 16;

const STORAGE_KEY = JOURNAL_ENTRIES_STORAGE_KEY;

// Default to AsyncStorage, but allow injection for testing.
let storageAdapter: StorageAdapter = AsyncStorage;
let mutationQueue: Promise<void> = Promise.resolve();

export function setStorageAdapter(adapter: StorageAdapter): void {
    storageAdapter = adapter;
}

export function resetStorageAdapter(): void {
    storageAdapter = AsyncStorage;
}

function generateId(): string {
    return `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getStorageForAccount(accountId: string | null): AccountStorageAdapter {
    return createAccountScopedStorageAdapter(storageAdapter, accountId);
}

function withMutationLock<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

interface JournalEntriesShardPayload {
    schemaVersion: number;
    entries: Record<string, JournalEntry>;
}

interface JournalEntriesIndexPayload {
    schemaVersion: number;
    shardCount: number;
    entryCount: number;
    entries: JournalEntrySummary[];
}

interface JournalStore {
    map: Record<string, JournalEntry>;
    /** Index payload as loaded, so a save only rewrites it when it moved. */
    indexPayload: string | null;
    /** Canonical payload of each shard at load (callers mutate `map` in place). */
    shardCanonical: string[];
    /** Whether each shard key existed at load. */
    shardExists: boolean[];
    /** True when the index key still held the pre-shard v1 payload. */
    legacy: boolean;
}

function shardStorageKey(index: number): string {
    return `${JOURNAL_ENTRIES_SHARD_KEY_PREFIX}${String(index)}`;
}

/** FNV-1a over the entry id: stable, cheap, spreads ids evenly across shards. */
function shardIndexOf(id: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < id.length; i += 1) {
        hash ^= id.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash % JOURNAL_ENTRIES_SHARD_COUNT;
}

function serializeShard(entries: Record<string, JournalEntry>): string {
    return JSON.stringify({
        schemaVersion: JOURNAL_ENTRIES_SCHEMA_VERSION,
        entries,
    } satisfies JournalEntriesShardPayload);
}

const EMPTY_SHARD_PAYLOAD = serializeShard({});

/**
 * Pull an entry map out of any payload this module has ever written:
 *  - a v2 shard / backup bundle (`{schemaVersion, entries}`)
 *  - the pre-shard v1 raw map (`{id: entry}`)
 * Returns null for the index payload (identified by its `shardCount` header),
 * for absent keys, and for anything that will not parse. The failure is
 * announced — a corrupt payload is a lost entry, not a quiet empty store.
 */
function entriesFromPayload(
    json: string | null,
    key: string,
): Record<string, JournalEntry> | null {
    if (!json) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        console.warn(`Journal storage: corrupt payload at ${key} treated as empty.`);
        return null;
    }
    if (!isRecord(parsed)) return null;
    // The index carries no entries; it is identified by its own header, not by
    // its version — v2 shard payloads are entry payloads and must not match.
    if ('shardCount' in parsed) return null;
    if ('entries' in parsed && isRecord(parsed.entries)) {
        return parsed.entries as Record<string, JournalEntry>;
    }
    return parsed as Record<string, JournalEntry>;
}

function toSummary(id: string, entry: JournalEntry): JournalEntrySummary {
    const raw = entry as unknown as Record<string, unknown>;
    const origin = raw.origin;
    return {
        id,
        title: typeof raw.title === 'string' ? raw.title : '',
        emoji: typeof raw.emoji === 'string' ? raw.emoji : '📝',
        status: raw.status === 'draft' ? 'draft' : 'completed',
        createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0,
        updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
        ...(origin === 'chat' || origin === 'threads' ? { origin } : {}),
    };
}

function sanitizeSummary(value: unknown): JournalEntrySummary | null {
    if (!isRecord(value)) return null;
    if (typeof value.id !== 'string' || !value.id) return null;
    if (typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt)) return null;
    return {
        id: value.id,
        title: typeof value.title === 'string' ? value.title : '',
        emoji: typeof value.emoji === 'string' ? value.emoji : '📝',
        status: value.status === 'draft' ? 'draft' : 'completed',
        createdAt: typeof value.createdAt === 'number' && Number.isFinite(value.createdAt)
            ? value.createdAt
            : 0,
        updatedAt: value.updatedAt,
        ...(value.origin === 'chat' || value.origin === 'threads' ? { origin: value.origin } : {}),
    };
}

function buildIndexPayload(
    map: Record<string, JournalEntry>,
): JournalEntriesIndexPayload {
    const entries = Object.entries(map)
        .map(([id, entry]) => toSummary(id, entry))
        .sort((a, b) => b.updatedAt - a.updatedAt);
    return {
        schemaVersion: JOURNAL_ENTRIES_SCHEMA_VERSION,
        shardCount: JOURNAL_ENTRIES_SHARD_COUNT,
        entryCount: entries.length,
        entries,
    };
}

function bucketEntries(
    map: Record<string, JournalEntry>,
): Record<string, JournalEntry>[] {
    const buckets: Record<string, JournalEntry>[] = Array.from(
        { length: JOURNAL_ENTRIES_SHARD_COUNT },
        () => ({}),
    );
    Object.entries(map).forEach(([id, entry]) => {
        buckets[shardIndexOf(id)][id] = entry;
    });
    return buckets;
}

/**
 * Load the index + every shard. A v1 payload at the index key folds in first
 * (and is rewritten as shards by the next save); shards win on conflict so a
 * partially-written migration keeps the newer copy.
 */
async function loadStore(
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<JournalStore> {
    const shardKeys = Array.from(
        { length: JOURNAL_ENTRIES_SHARD_COUNT },
        (_, index) => shardStorageKey(index),
    );
    const [indexPayload, ...shardPayloads] = await Promise.all([
        storage.getItem(STORAGE_KEY),
        ...shardKeys.map((key) => storage.getItem(key)),
    ]);
    assertAccountOperationActive(context);

    const map: Record<string, JournalEntry> = {};
    const shardCanonical: string[] = [];
    const shardExists: boolean[] = [];

    const legacyEntries = entriesFromPayload(indexPayload, STORAGE_KEY);
    const legacy = legacyEntries !== null;
    if (legacyEntries) Object.assign(map, legacyEntries);

    for (let index = 0; index < shardKeys.length; index += 1) {
        const stored = shardPayloads[index] ?? null;
        const entries = entriesFromPayload(stored, shardKeys[index]);
        // A shard dropped as corrupt counts as absent, so the next save writes
        // fresh entries instead of treating the dead payload as current.
        shardExists[index] = entries !== null && stored !== null;
        shardCanonical[index] = serializeShard(entries ?? {});
        if (entries) Object.assign(map, entries);
    }

    return { map, indexPayload, shardCanonical, shardExists, legacy };
}

/**
 * Write changed shards, then the index. Shards before the index: an interrupted
 * save leaves the older index payload behind, and the next load still reads the
 * full v1 payload until the index write lands.
 */
async function saveStore(
    storage: AccountStorageAdapter,
    store: JournalStore,
    map: Record<string, JournalEntry>,
    context: AccountOperationContext,
): Promise<void> {
    const next = bucketEntries(map).map(serializeShard);

    for (let index = 0; index < next.length; index += 1) {
        const willBeEmpty = next[index] === EMPTY_SHARD_PAYLOAD;
        if (
            next[index] === store.shardCanonical[index]
            && store.shardExists[index] === !willBeEmpty
        ) {
            continue;
        }
        if (willBeEmpty) {
            await storage.removeItem(shardStorageKey(index));
        } else {
            await storage.setItem(shardStorageKey(index), next[index]);
        }
        assertAccountOperationActive(context);
    }

    if (Object.keys(map).length === 0) {
        if (store.indexPayload !== null) {
            await storage.removeItem(STORAGE_KEY);
            assertAccountOperationActive(context);
        }
        return;
    }

    // Always rewrite the index. It is small, and a caller that reaches a save
    // must observe a write to the owning key (the account-switch race tests and
    // restore delegation depend on it); a conditional skip made an import that
    // matched the current store silently write nothing.
    await storage.setItem(STORAGE_KEY, JSON.stringify(buildIndexPayload(map)));
    assertAccountOperationActive(context);
}

async function readShard(
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
    index: number,
): Promise<Record<string, JournalEntry>> {
    const key = shardStorageKey(index);
    const json = await storage.getItem(key);
    assertAccountOperationActive(context);
    return entriesFromPayload(json, key) ?? {};
}

/**
 * One-time, in-place migration of a v1 single-value payload to shards + index.
 * Idempotent: the `shardCount` header marks an already-migrated index, and the
 * rewrite is re-checked inside the lock so concurrent readers migrate once.
 * A failed migration is announced and does not break the read — the v1 payload
 * is still loadable until the index write succeeds.
 */
async function ensureMigrated(
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<void> {
    const json = await storage.getItem(STORAGE_KEY);
    assertAccountOperationActive(context);
    if (!json) return;
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        return;
    }
    if (!isRecord(parsed) || 'shardCount' in parsed) return;

    await withMutationLock(async () => {
        assertAccountOperationActive(context);
        const store = await loadStore(storage, context);
        if (!store.legacy) return;
        try {
            await saveStore(storage, store, store.map, context);
        } catch (error) {
            console.warn(
                'Journal storage: shard migration failed; the v1 payload is '
                + 'still readable and migration will retry on the next load.',
                error,
            );
        }
    });
}

async function readIndexSummaries(
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<JournalEntrySummary[]> {
    const json = await storage.getItem(STORAGE_KEY);
    assertAccountOperationActive(context);
    if (!json) return [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        return [];
    }
    if (!isRecord(parsed)) return [];
    if ('shardCount' in parsed && Array.isArray(parsed.entries)) {
        return parsed.entries
            .map(sanitizeSummary)
            .filter((summary): summary is JournalEntrySummary => summary !== null);
    }
    // Pre-migration fallback: derive summaries from the v1 map without reading
    // any shard. Only reachable if the migration write failed.
    return Object.entries(parsed).map(([id, entry]) => toSummary(id, entry as JournalEntry));
}

async function listEntriesForAccount(
    status: 'draft' | 'completed' | undefined,
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<JournalEntry[]> {
    assertAccountOperationActive(context);
    await ensureMigrated(storage, context);
    const store = await loadStore(storage, context);
    let list = Object.values(store.map);

    if (status) {
        list = list.filter((entry) => entry.status === status);
    }

    // Sort by updatedAt descending.
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    assertAccountOperationActive(context);
    return list;
}

/**
 * Create a new journal entry.
 */
export function createEntry(input: JournalEntryCreateInput): Promise<JournalEntry> {
    return runAccountBoundOperation('journal-create', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        const now = Date.now();
        const createdAt = typeof input.createdAt === 'number' && Number.isFinite(input.createdAt)
            ? input.createdAt
            : now;
        const updatedAt = typeof input.updatedAt === 'number' && Number.isFinite(input.updatedAt)
            ? input.updatedAt
            : createdAt;
        const entry: JournalEntry = {
            id: generateId(),
            title: input.title || 'Untitled',
            emoji: input.emoji || '📝',
            messages: input.messages,
            status: input.status,
            analysis: input.analysis,
            createdAt,
            updatedAt,
            ...(input.origin ? { origin: input.origin } : {}),
        };

        await withMutationLock(async () => {
            assertAccountOperationActive(context);
            const store = await loadStore(storage, context);
            const map = store.map;
            map[entry.id] = entry;
            await saveStore(storage, store, map, context);
        });
        assertAccountOperationActive(context);
        return entry;
    });
}

/**
 * Get a single entry by ID. Reads only the one shard that owns the id.
 */
export function getEntry(id: string): Promise<JournalEntry | null> {
    return runAccountBoundOperation('journal-get', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        await ensureMigrated(storage, context);
        const entries = await readShard(storage, context, shardIndexOf(id));
        return entries[id] ?? null;
    });
}

/**
 * Update an existing entry.
 */
export function updateEntry(
    id: string,
    input: JournalEntryUpdateInput,
): Promise<JournalEntry | null> {
    return runAccountBoundOperation('journal-update', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        const updated = await withMutationLock(async () => {
            assertAccountOperationActive(context);
            const store = await loadStore(storage, context);
            const map = store.map;
            const existing = map[id];
            if (!existing) return null;

            const next: JournalEntry = {
                ...existing,
                ...input,
                messages: input.messages ?? existing.messages,
                updatedAt: Date.now(),
            };
            map[id] = next;
            await saveStore(storage, store, map, context);
            return next;
        });

        assertAccountOperationActive(context);
        return updated;
    });
}

/**
 * Delete an entry by ID.
 */
export function deleteEntry(id: string): Promise<boolean> {
    return runAccountBoundOperation('journal-delete', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        const deleted = await withMutationLock(async () => {
            assertAccountOperationActive(context);
            const store = await loadStore(storage, context);
            const map = store.map;
            if (!map[id]) return false;
            delete map[id];
            await saveStore(storage, store, map, context);
            return true;
        });

        assertAccountOperationActive(context);
        return deleted;
    });
}

/**
 * List all entries, optionally filtered by status.
 * Returns entries sorted by updatedAt descending (newest first).
 * Full rows: this loads every shard. Callers that only need metadata should
 * use `listEntrySummaries`, which reads the index alone.
 */
export function listEntries(
    status?: 'draft' | 'completed',
): Promise<JournalEntry[]> {
    return runAccountBoundOperation('journal-list', (context) => (
        listEntriesForAccount(status, getStorageForAccount(context.accountId), context)
    ));
}

/**
 * List entry summaries (id/title/emoji/status/dates/origin) without loading any
 * shard — the index read path. Use this for History/Today lists and history
 * tools that only need metadata.
 */
export function listEntrySummaries(
    status?: 'draft' | 'completed',
): Promise<JournalEntrySummary[]> {
    return runAccountBoundOperation('journal-list-summaries', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        await ensureMigrated(storage, context);
        const summaries = await readIndexSummaries(storage, context);
        const filtered = status
            ? summaries.filter((summary) => summary.status === status)
            : summaries;
        return [...filtered].sort((a, b) => b.updatedAt - a.updatedAt);
    });
}

/**
 * List only draft entries.
 */
export function listDrafts(): Promise<JournalEntry[]> {
    return runAccountBoundOperation('journal-list-drafts', (context) => (
        listEntriesForAccount('draft', getStorageForAccount(context.accountId), context)
    ));
}

/**
 * List only completed entries.
 */
export function listCompleted(): Promise<JournalEntry[]> {
    return runAccountBoundOperation('journal-list-completed', (context) => (
        listEntriesForAccount('completed', getStorageForAccount(context.accountId), context)
    ));
}

export function clearAllEntries(): Promise<void> {
    return runAccountBoundOperation('journal-clear', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        await withMutationLock(async () => {
            assertAccountOperationActive(context);

            await storage.removeItem(STORAGE_KEY);
            assertAccountOperationActive(context);

            for (let index = 0; index < JOURNAL_ENTRIES_SHARD_COUNT; index += 1) {
                await storage.removeItem(shardStorageKey(index));
                assertAccountOperationActive(context);
            }

            // Account isolation contract (kept deliberately): a real account
            // switch pauses and aborts this lease, and the caller must learn
            // that the operation was aborted rather than see a silent success.
            // The local wipe above is scoped to this context's account, so the
            // abort can never clear the other account's rows.
            assertAccountOperationActive(context);
        });
    });
}

export function getAllEntriesForExport(): Promise<string> {
    return runAccountBoundOperation('journal-export', async (context) => {
        const list = await listEntriesForAccount(
            undefined,
            getStorageForAccount(context.accountId),
            context,
        );
        assertAccountOperationActive(context);
        return JSON.stringify(list, null, 2);
    });
}

/**
 * Pack every entry into one JSON string for the local backup record. Runtime
 * stays sharded; the backup re-shards through `importJournalEntriesSnapshot` on
 * restore, so the bundle string never becomes an AsyncStorage key.
 */
export function exportJournalEntriesBundle(): Promise<string | null> {
    return runAccountBoundOperation('journal-export-bundle', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        await ensureMigrated(storage, context);
        const store = await loadStore(storage, context);
        if (Object.keys(store.map).length === 0) return null;
        return JSON.stringify({
            schemaVersion: JOURNAL_ENTRIES_SCHEMA_VERSION,
            entries: store.map,
        });
    });
}

export function migrateLegacyJournalEntriesToActiveAccount(): Promise<void> {
    return runAccountBoundOperation('journal-legacy-migration', async (context) => {
        const ownerStorage = storageAdapter;
        await withMutationLock(async () => {
            assertAccountOperationActive(context);
            await claimLegacyStorageKey(STORAGE_KEY, ownerStorage);
            assertAccountOperationActive(context);
        });
    });
}

export function hasLegacyJournalEntries(): Promise<boolean> {
    return runAccountBoundOperation('journal-legacy-inspection', async (context) => {
        const ownerStorage = storageAdapter;
        const value = await ownerStorage.getItem(STORAGE_KEY);
        assertAccountOperationActive(context);
        return value !== null;
    });
}

export function importJournalEntriesSnapshot(
    value: string | null,
    delegate?: (context: AccountOperationContext) => Promise<void>,
): Promise<void> {
    return runAccountBoundOperation('journal-import', async (context) => {
        await withMutationLock(async () => {
            assertAccountOperationActive(context);
            await (delegate ?? importJournalEntriesForAccount)(context, value);
            assertAccountOperationActive(context);
        });
    });
}

/**
 * Parse an imported payload. Tolerates every shape this module has emitted:
 * a backup bundle `{schemaVersion, entries}`, the pre-shard raw map
 * `{id: entry}`, and the pretty export array from `getAllEntriesForExport`.
 */
function parseImportedEntries(value: string): Record<string, JournalEntry> {
    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch {
        // Corrupt backup payload restores the owner's safe empty default.
        return {};
    }
    if (Array.isArray(parsed)) {
        const map: Record<string, JournalEntry> = {};
        for (const row of parsed) {
            if (isRecord(row) && typeof row.id === 'string') {
                map[row.id] = row as unknown as JournalEntry;
            }
        }
        return map;
    }
    if (isRecord(parsed)) {
        if ('entries' in parsed && isRecord(parsed.entries)) {
            return parsed.entries as Record<string, JournalEntry>;
        }
        return parsed as Record<string, JournalEntry>;
    }
    return {};
}

/**
 * Replace the account's journal store with the imported snapshot. Runs inside
 * the caller's mutation lock (`importJournalEntriesSnapshot`); callers that
 * hold the lock must not call this again.
 */
export async function importJournalEntriesForAccount(
    context: AccountOperationContext,
    value: string | null,
): Promise<void> {
    const storage = getStorageForAccount(context.accountId);
    if (value === null) {
        await storage.removeItem(STORAGE_KEY);
        assertAccountOperationActive(context);
        for (let index = 0; index < JOURNAL_ENTRIES_SHARD_COUNT; index += 1) {
            await storage.removeItem(shardStorageKey(index));
            assertAccountOperationActive(context);
        }
        return;
    }
    const store = await loadStore(storage, context);
    const entries = parseImportedEntries(value);
    await saveStore(storage, store, entries, context);
}

registerAccountTeardown(async () => {
    await mutationQueue;
});
