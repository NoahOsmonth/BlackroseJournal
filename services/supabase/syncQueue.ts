import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureSupabaseSession } from './supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';

const SYNC_QUEUE_KEY = '@supabase_sync_queue';
const MAX_QUEUE_SIZE = 1000;

export type SyncOperation = 'upsert' | 'delete';

export interface SyncTask {
    id: string;
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
}

let storageAdapter: KeyValueStorage = AsyncStorage;
let flushPromise: Promise<void> | null = null;

export function setSyncQueueStorageAdapter(adapter: KeyValueStorage): void {
    storageAdapter = adapter;
}

export function resetSyncQueueStorageAdapter(): void {
    storageAdapter = AsyncStorage;
}

function generateTaskId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function loadQueue(): Promise<SyncTask[]> {
    const json = await storageAdapter.getItem(SYNC_QUEUE_KEY);
    if (!json) {
        return [];
    }

    try {
        const parsed = JSON.parse(json) as SyncTask[];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function saveQueue(queue: SyncTask[]): Promise<void> {
    await storageAdapter.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

function resolveDedupeKey(task: Omit<SyncTask, 'id' | 'createdAt'>): string | null {
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
    task: Omit<SyncTask, 'id' | 'createdAt'>
): Promise<SyncTask> {
    const queue = await loadQueue();
    const dedupeKey = resolveDedupeKey(task);

    const filtered = dedupeKey
        ? queue.filter(existing => existing.dedupeKey !== dedupeKey)
        : queue;

    const nextTask: SyncTask = {
        ...task,
        id: generateTaskId(),
        dedupeKey: dedupeKey ?? task.dedupeKey,
        createdAt: Date.now(),
    };

    const nextQueue = pruneQueue([...filtered, nextTask]);
    await saveQueue(nextQueue);

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
            console.warn('Supabase sync upsert failed:', error.message);
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
            console.warn('Supabase sync delete failed:', error.message);
            return false;
        }

        return true;
    }

    return true;
}

export async function flushSyncQueue(): Promise<void> {
    if (flushPromise) {
        return flushPromise;
    }

    flushPromise = (async () => {
        while (true) {
            const queue = await loadQueue();
            if (queue.length === 0) {
                return;
            }

            const client = await ensureSupabaseSession();
            if (!client) {
                return;
            }

            const processedIds = new Set<string>();
            let failedIndex: number | null = null;

            for (let i = 0; i < queue.length; i += 1) {
                const task = queue[i];
                const success = await applyTask(client, task);

                if (!success) {
                    failedIndex = i;
                    break;
                }

                processedIds.add(task.id);
            }

            const latestQueue = await loadQueue();
            const nextQueue = latestQueue.filter((task) => !processedIds.has(task.id));

            if (failedIndex !== null) {
                const pending = queue.slice(failedIndex);
                const pendingIds = new Set(nextQueue.map((task) => task.id));
                pending.forEach((task) => {
                    if (!pendingIds.has(task.id)) {
                        nextQueue.push(task);
                    }
                });

                await saveQueue(nextQueue);
                return;
            }

            await saveQueue(nextQueue);
        }
    })();

    try {
        await flushPromise;
    } finally {
        flushPromise = null;
    }
}
