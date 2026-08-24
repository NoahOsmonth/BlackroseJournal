import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRemoteDataSyncEnabled } from '@/services/data/dataProvider';
import { ensureSupabaseSession } from './supabaseClient';
import { logSupabaseError } from './supabaseErrors';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
    getActiveAccountId,
    registerAccountTeardown,
    requireActiveAccountId,
} from '@/services/account/accountRuntime';
import { getAccountScopedStorageKey } from '@/services/account/accountScopedStorage';

const SYNC_QUEUE_KEY = '@supabase_sync_queue';
const SYNC_QUEUE_QUARANTINE_KEY = '@supabase_sync_queue_quarantine';
const MAX_QUEUE_SIZE = 1000;

export type SyncOperation = 'upsert' | 'delete';

export interface SyncTask {
    id: string;
    accountId: string;
    table: string;
    operation: SyncOperation;
    payload?: object;
    primaryKey?: string;
    primaryValue?: string | number;
    onConflict?: string;
    dedupeKey?: string;
    createdAt: number;
}

interface KeyValueStorage {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem?(key: string): Promise<void>;
}

let storageAdapter: KeyValueStorage = AsyncStorage;
let flushPromise: Promise<void> | null = null;
let mutationQueue: Promise<void> = Promise.resolve();

export function setSyncQueueStorageAdapter(adapter: KeyValueStorage): void {
    storageAdapter = adapter;
}

export function resetSyncQueueStorageAdapter(): void {
    storageAdapter = AsyncStorage;
}

function generateTaskId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOptionalString(value: Record<string, unknown>, key: string): boolean {
    return value[key] === undefined || typeof value[key] === 'string';
}

function isSyncTaskShape(value: unknown, requireAccountId: boolean): value is SyncTask {
    if (!isRecord(value)) return false;
    if (typeof value.id !== 'string' || value.id.length === 0) return false;
    if (requireAccountId && typeof value.accountId !== 'string') return false;
    if (typeof value.table !== 'string' || value.table.length === 0) return false;
    if (value.operation !== 'upsert' && value.operation !== 'delete') return false;
    if (typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt)) return false;
    if (!hasOptionalString(value, 'primaryKey')) return false;
    if (!hasOptionalString(value, 'onConflict')) return false;
    if (!hasOptionalString(value, 'dedupeKey')) return false;
    if (
        value.primaryValue !== undefined
        && typeof value.primaryValue !== 'string'
        && typeof value.primaryValue !== 'number'
    ) return false;
    if (value.payload !== undefined && !isRecord(value.payload)) return false;
    return value.operation === 'upsert'
        ? isRecord(value.payload)
        : typeof value.primaryKey === 'string' && value.primaryValue !== undefined;
}

function withMutationLock<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

async function loadTasks(key: string): Promise<SyncTask[]> {
    const json = await storageAdapter.getItem(getAccountScopedStorageKey(key));
    if (!json) {
        return [];
    }

    try {
        const parsed = JSON.parse(json) as unknown;
        return Array.isArray(parsed)
            ? parsed.filter((task): task is SyncTask => isSyncTaskShape(task, true))
            : [];
    } catch {
        return [];
    }
}

async function saveTasks(key: string, queue: SyncTask[]): Promise<void> {
    await storageAdapter.setItem(getAccountScopedStorageKey(key), JSON.stringify(queue));
}

function loadQueue(): Promise<SyncTask[]> {
    return loadTasks(SYNC_QUEUE_KEY);
}

function saveQueue(queue: SyncTask[]): Promise<void> {
    return saveTasks(SYNC_QUEUE_KEY, queue);
}

async function quarantineTasks(tasks: readonly SyncTask[]): Promise<void> {
    if (tasks.length === 0) return;
    const taskIds = new Set(tasks.map((task) => task.id));
    const [latestQueue, quarantined] = await Promise.all([
        loadQueue(),
        loadTasks(SYNC_QUEUE_QUARANTINE_KEY),
    ]);
    await saveTasks(
        SYNC_QUEUE_QUARANTINE_KEY,
        pruneQueue([...quarantined, ...latestQueue.filter((task) => taskIds.has(task.id))])
    );
    await saveQueue(latestQueue.filter((task) => !taskIds.has(task.id)));
}

type SyncTaskInput = Omit<SyncTask, 'id' | 'createdAt' | 'accountId'>;

function resolveDedupeKey(task: SyncTaskInput): string | null {
    if (task.dedupeKey) {
        return task.dedupeKey;
    }

    const payloadId = task.payload && typeof task.payload === 'object'
        ? (task.payload as { id?: string | number }).id
        : undefined;

    if (payloadId !== undefined) {
        return `${task.table}:${payloadId}`;
    }

    if (task.primaryKey && task.primaryValue !== undefined) {
        return `${task.table}:${task.primaryKey}:${task.primaryValue}`;
    }

    return null;
}

function pruneQueue(queue: SyncTask[]): SyncTask[] {
    if (queue.length <= MAX_QUEUE_SIZE) {
        return queue;
    }

    return queue.slice(queue.length - MAX_QUEUE_SIZE);
}

export async function enqueueSyncTask(
    task: SyncTaskInput
): Promise<SyncTask> {
    const dedupeKey = resolveDedupeKey(task);
    const accountId = isRemoteDataSyncEnabled() ? requireActiveAccountId() : null;
    const nextTask: SyncTask = {
        ...task,
        id: generateTaskId(),
        accountId: accountId ?? '',
        dedupeKey: dedupeKey ?? task.dedupeKey,
        createdAt: Date.now(),
    };

    if (!isRemoteDataSyncEnabled()) {
        return nextTask;
    }

    await withMutationLock(async () => {
        const queue = await loadQueue();
        const filtered = dedupeKey
            ? queue.filter(existing => existing.dedupeKey !== dedupeKey)
            : queue;
        await saveQueue(pruneQueue([...filtered, nextTask]));
    });

    void flushSyncQueue();

    return nextTask;
}

async function applyTask(client: SupabaseClient, task: SyncTask): Promise<boolean> {
    if (task.operation === 'upsert' && task.payload) {
        const payload = task.payload as Record<string, unknown>;
        const { error } = await client
            .from(task.table)
            .upsert(payload, task.onConflict ? { onConflict: task.onConflict } : undefined);

        if (error) {
            logSupabaseError('Supabase sync upsert failed', task.table, error.message);
            return false;
        }

        return true;
    }

    if (task.operation === 'delete' && task.primaryKey) {
        const { error } = await client
            .from(task.table)
            .delete()
            .eq(task.primaryKey, task.primaryValue ?? '');

        if (error) {
            logSupabaseError('Supabase sync delete failed', task.table, error.message);
            return false;
        }

        return true;
    }

    return true;
}

async function sessionMatchesAccount(
    client: SupabaseClient,
    accountId: string
): Promise<boolean> {
    const { data, error } = await client.auth.getSession();
    return !error && data.session?.user.id === accountId;
}

export async function removeSyncTasksForTable(table: string): Promise<void> {
    if (!isRemoteDataSyncEnabled()) return;
    requireActiveAccountId();
    await withMutationLock(async () => {
        const queue = await loadQueue();
        const next = queue.filter((task) => task.table !== table);
        if (next.length !== queue.length) await saveQueue(next);
    });
}

export async function flushSyncQueue(): Promise<void> {
    if (!isRemoteDataSyncEnabled()) {
        return;
    }

    if (flushPromise) {
        return flushPromise;
    }

    const accountId = requireActiveAccountId();
    flushPromise = (async () => {
        while (true) {
            const queue = await withMutationLock(async () => {
                const loaded = await loadQueue();
                const owned = loaded.filter((task) => task.accountId === accountId);
                const foreign = loaded.filter((task) => task.accountId !== accountId);
                if (foreign.length > 0) {
                    await quarantineTasks(foreign);
                }
                return owned;
            });
            if (queue.length === 0) {
                return;
            }

            const client = await ensureSupabaseSession();
            if (!client) {
                return;
            }

            if (!(await sessionMatchesAccount(client, accountId))) {
                await withMutationLock(() => quarantineTasks(queue));
                return;
            }

            const processedIds = new Set<string>();
            let failedIndex: number | null = null;

            for (let i = 0; i < queue.length; i += 1) {
                const task = queue[i];
                if (task.accountId !== accountId || getActiveAccountId() !== accountId) {
                    return;
                }
                // Supabase auth state can change before account teardown begins.
                // Revalidate immediately before every network mutation so a task
                // queued by A is never submitted with B's live credentials.
                if (!(await sessionMatchesAccount(client, accountId))) {
                    failedIndex = i;
                    break;
                }
                const success = await applyTask(client, task);

                if (!success) {
                    failedIndex = i;
                    break;
                }

                processedIds.add(task.id);
            }

            await withMutationLock(async () => {
                const latestQueue = await loadQueue();
                const nextQueue = latestQueue.filter((task) => !processedIds.has(task.id));
                if (failedIndex !== null) {
                    const pending = queue.slice(failedIndex);
                    const pendingIds = new Set(nextQueue.map((task) => task.id));
                    pending.forEach((task) => {
                        if (!pendingIds.has(task.id)) nextQueue.push(task);
                    });
                }
                await saveQueue(nextQueue);
            });
            if (failedIndex !== null) return;
        }
    })();

    try {
        await flushPromise;
    } finally {
        flushPromise = null;
    }
}

registerAccountTeardown(async () => {
    if (flushPromise) await flushPromise;
    await mutationQueue;
});

export async function hasLegacySyncQueue(): Promise<boolean> {
    return (await storageAdapter.getItem(SYNC_QUEUE_KEY)) !== null;
}

export async function migrateLegacySyncQueueToActiveAccount(): Promise<void> {
    const accountId = requireActiveAccountId();
    await withMutationLock(async () => {
        const raw = await storageAdapter.getItem(SYNC_QUEUE_KEY);
        if (raw === null) return;
        if (!storageAdapter.removeItem) {
            throw new Error('Sync queue migration requires removeItem support.');
        }
        let legacy: unknown;
        try {
            legacy = JSON.parse(raw) as unknown;
        } catch {
            throw new Error('Legacy sync queue is corrupt and was not claimed.');
        }
        if (!Array.isArray(legacy)) {
            throw new Error('Legacy sync queue is invalid and was not claimed.');
        }
        if (!legacy.every((task) => isSyncTaskShape(task, false))) {
            throw new Error('Legacy sync queue is invalid and was not claimed.');
        }
        const tagged = legacy.map((task) => ({ ...task, accountId }));
        const current = await loadQueue();
        await saveQueue(pruneQueue([...current, ...tagged]));
        await storageAdapter.removeItem(SYNC_QUEUE_KEY);
    });
}
