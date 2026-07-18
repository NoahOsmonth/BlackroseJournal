/**
 * Sharded week/month/year rollup store.
 *
 * Keys (this module owns them):
 *   @rosebud_memory_rollup_index
 *   @rosebud_memory_rollup:<kind>:<periodKey>
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
    MemoryRollup,
    MemoryRollupIndex,
    MemoryRollupIndexEntry,
    MemoryRollupKind,
    MemoryRollupListOptions,
    MemoryRollupStorageAdapter,
} from './memoryRollup.types';

export const MEMORY_ROLLUP_INDEX_KEY = '@rosebud_memory_rollup_index';
export const MEMORY_ROLLUP_KEY_PREFIX = '@rosebud_memory_rollup:';
export const MEMORY_ROLLUP_SCHEMA_VERSION = 1;

const MAX_SUMMARY_CHARS = 600;
const MAX_TOPICS = 10;

let storageAdapter: MemoryRollupStorageAdapter = AsyncStorage;

export function setMemoryRollupStorageAdapter(adapter: MemoryRollupStorageAdapter): void {
    storageAdapter = adapter;
}

export function resetMemoryRollupStorageAdapter(): void {
    storageAdapter = AsyncStorage;
}

let writeQueue: Promise<unknown> = Promise.resolve();

function withRollupLock<T>(task: () => Promise<T>): Promise<T> {
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

function isKind(value: unknown): value is MemoryRollupKind {
    return value === 'week' || value === 'month' || value === 'year';
}

export function memoryRollupRecordKey(kind: MemoryRollupKind, periodKey: string): string {
    return `${MEMORY_ROLLUP_KEY_PREFIX}${kind}:${periodKey}`;
}

export function memoryRollupId(kind: MemoryRollupKind, periodKey: string): string {
    return `${kind}:${periodKey}`;
}

function emptyIndex(): MemoryRollupIndex {
    return { schemaVersion: MEMORY_ROLLUP_SCHEMA_VERSION, entries: [] };
}

function sanitizeIndexEntry(value: unknown): MemoryRollupIndexEntry | null {
    if (!isRecord(value)) return null;
    if (typeof value.id !== 'string' || !value.id) return null;
    if (!isKind(value.kind)) return null;
    if (typeof value.periodKey !== 'string' || !value.periodKey) return null;
    if (typeof value.dateFrom !== 'string' || !value.dateFrom) return null;
    if (typeof value.dateTo !== 'string' || !value.dateTo) return null;
    if (typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt)) return null;
    return {
        id: value.id,
        kind: value.kind,
        periodKey: value.periodKey,
        dateFrom: value.dateFrom,
        dateTo: value.dateTo,
        updatedAt: value.updatedAt,
    };
}

function sanitizeRollup(value: unknown): MemoryRollup | null {
    if (!isRecord(value)) return null;
    if (!isKind(value.kind)) return null;
    if (typeof value.periodKey !== 'string' || !value.periodKey) return null;
    if (typeof value.dateFrom !== 'string' || !value.dateFrom) return null;
    if (typeof value.dateTo !== 'string' || !value.dateTo) return null;
    if (typeof value.summary !== 'string') return null;
    if (!Array.isArray(value.topics) || !Array.isArray(value.embedding)) return null;
    if (typeof value.sourceCount !== 'number' || !Number.isFinite(value.sourceCount)) return null;
    if (typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt)) return null;
    if (typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt)) return null;

    const embedding: number[] = [];
    for (const n of value.embedding) {
        if (typeof n === 'number' && Number.isFinite(n)) embedding.push(n);
    }
    const topics = value.topics
        .filter((t): t is string => typeof t === 'string')
        .map((t) => trimText(t, 48))
        .filter(Boolean)
        .slice(0, MAX_TOPICS);

    return {
        schemaVersion: MEMORY_ROLLUP_SCHEMA_VERSION,
        kind: value.kind,
        periodKey: value.periodKey,
        dateFrom: value.dateFrom,
        dateTo: value.dateTo,
        summary: trimText(value.summary, MAX_SUMMARY_CHARS),
        topics,
        embedding,
        sourceCount: Math.max(0, Math.floor(value.sourceCount)),
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
    };
}

async function loadIndexUnlocked(): Promise<MemoryRollupIndex> {
    try {
        const json = await storageAdapter.getItem(MEMORY_ROLLUP_INDEX_KEY);
        if (!json) return emptyIndex();
        let parsed: unknown;
        try {
            parsed = JSON.parse(json);
        } catch {
            return emptyIndex();
        }
        if (!isRecord(parsed) || !Array.isArray(parsed.entries)) return emptyIndex();
        const entries: MemoryRollupIndexEntry[] = [];
        for (const row of parsed.entries) {
            const e = sanitizeIndexEntry(row);
            if (e) entries.push(e);
        }
        return { schemaVersion: MEMORY_ROLLUP_SCHEMA_VERSION, entries };
    } catch {
        return emptyIndex();
    }
}

async function saveIndexUnlocked(index: MemoryRollupIndex): Promise<void> {
    await storageAdapter.setItem(
        MEMORY_ROLLUP_INDEX_KEY,
        JSON.stringify({
            schemaVersion: MEMORY_ROLLUP_SCHEMA_VERSION,
            entries: index.entries,
        }),
    );
}

async function multiRemoveKeys(keys: readonly string[]): Promise<void> {
    if (keys.length === 0) return;
    if (storageAdapter.multiRemove) {
        await storageAdapter.multiRemove(keys);
        return;
    }
    await Promise.all(keys.map((k) => storageAdapter.removeItem(k)));
}

export async function upsertMemoryRollup(rollup: MemoryRollup): Promise<MemoryRollup> {
    const clean = sanitizeRollup(rollup);
    if (!clean) throw new Error('Invalid memory rollup');

    return withRollupLock(async () => {
        const index = await loadIndexUnlocked();
        const id = memoryRollupId(clean.kind, clean.periodKey);
        const without = index.entries.filter((e) => e.id !== id);
        without.push({
            id,
            kind: clean.kind,
            periodKey: clean.periodKey,
            dateFrom: clean.dateFrom,
            dateTo: clean.dateTo,
            updatedAt: clean.updatedAt,
        });
        without.sort((a, b) => b.updatedAt - a.updatedAt);

        await storageAdapter.setItem(
            memoryRollupRecordKey(clean.kind, clean.periodKey),
            JSON.stringify(clean),
        );
        await saveIndexUnlocked({ schemaVersion: MEMORY_ROLLUP_SCHEMA_VERSION, entries: without });
        return clean;
    });
}

export async function getMemoryRollup(
    kind: MemoryRollupKind,
    periodKey: string,
): Promise<MemoryRollup | null> {
    try {
        const json = await storageAdapter.getItem(memoryRollupRecordKey(kind, periodKey));
        if (!json) return null;
        return sanitizeRollup(JSON.parse(json));
    } catch {
        return null;
    }
}

export async function listMemoryRollupIndex(
    options: MemoryRollupListOptions = {},
): Promise<MemoryRollupIndexEntry[]> {
    let entries = (await loadIndexUnlocked()).entries;
    if (options.kind) {
        entries = entries.filter((e) => e.kind === options.kind);
    }
    if (options.from) {
        entries = entries.filter((e) => e.dateTo >= options.from!);
    }
    if (options.to) {
        entries = entries.filter((e) => e.dateFrom <= options.to!);
    }
    if (options.limit !== undefined) {
        entries = entries.slice(0, Math.max(0, options.limit));
    }
    return entries;
}

export async function listMemoryRollups(
    options: MemoryRollupListOptions = {},
): Promise<MemoryRollup[]> {
    const entries = await listMemoryRollupIndex(options);
    const out: MemoryRollup[] = [];
    for (const entry of entries) {
        const row = await getMemoryRollup(entry.kind, entry.periodKey);
        if (row) out.push(row);
    }
    return out;
}

export async function clearMemoryRollups(): Promise<void> {
    await withRollupLock(async () => {
        const index = await loadIndexUnlocked();
        const keys = [
            MEMORY_ROLLUP_INDEX_KEY,
            ...index.entries.map((e) => memoryRollupRecordKey(e.kind, e.periodKey)),
        ];
        await multiRemoveKeys(keys);
        if (storageAdapter.getAllKeys) {
            try {
                const all = await storageAdapter.getAllKeys();
                const orphans = all.filter(
                    (k) => k.startsWith(MEMORY_ROLLUP_KEY_PREFIX) || k === MEMORY_ROLLUP_INDEX_KEY,
                );
                await multiRemoveKeys(orphans);
            } catch {
                // ignore
            }
        }
    });
}
