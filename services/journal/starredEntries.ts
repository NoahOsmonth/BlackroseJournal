/**
 * Starred entries — a small, local list of moments worth returning to.
 *
 * One storage key, one owner (AGENTS.md storage-key table). The payload has a
 * schemaVersion envelope so a future shape can migrate instead of being
 * misread. Every mutation goes through the module's serialized queue, because
 * AsyncStorage has no transactions and two interleaved read-modify-write cycles
 * would silently drop one side's star.
 */

import { AccountStorageAdapter, getStorageForAccount } from '@/services/account/accountScopedStorage';
import {
    assertAccountOperationActive,
    registerAccountTeardown,
    runAccountBoundOperation,
} from '@/services/account/accountRuntime';

export const STARRED_ENTRIES_KEY = '@blackrose_starred_entries';

const SCHEMA_VERSION = 1;

interface StarredPayload {
    schemaVersion: number;
    ids: string[];
    updatedAt: number;
}

const EMPTY: StarredPayload = { schemaVersion: SCHEMA_VERSION, ids: [], updatedAt: 0 };

let mutationQueue: Promise<void> = Promise.resolve();

/**
 * Screens subscribe instead of polling on focus: a star tapped in entry detail
 * is visible on Archive the moment it lands, with no navigation dependency.
 */
type StarredListener = (ids: readonly string[]) => void;
const changeListeners = new Set<StarredListener>();

export function subscribeStarredChanges(listener: StarredListener): () => void {
    changeListeners.add(listener);
    return () => { changeListeners.delete(listener); };
}

function notifyStarredChanged(ids: readonly string[]): void {
    changeListeners.forEach((listener) => {
        try {
            listener(ids);
        } catch {
            // A broken listener must never break a write.
        }
    });
}

/** Adapters are test-injected; reset the queue with the account. */
registerAccountTeardown(() => {
    mutationQueue = Promise.resolve();
});

function normalizeIds(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))];
}

/** Safe parse: a corrupt or older payload never throws into the UI. */
function parsePayload(raw: string | null): StarredPayload {
    if (!raw) return EMPTY;
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object') return EMPTY;
        const record = parsed as Record<string, unknown>;
        // A v1 envelope; a legacy bare array is also accepted so a pre-envelope
        // value is read rather than silently wiped.
        const ids = Array.isArray(parsed)
            ? normalizeIds(parsed)
            : normalizeIds(record.ids);
        return {
            schemaVersion: typeof record.schemaVersion === 'number' ? record.schemaVersion : SCHEMA_VERSION,
            ids,
            updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : 0,
        };
    } catch {
        return EMPTY;
    }
}

async function readPayload(storage: AccountStorageAdapter): Promise<StarredPayload> {
    return parsePayload(await storage.getItem(STARRED_ENTRIES_KEY));
}

async function writePayload(
    storage: AccountStorageAdapter,
    payload: StarredPayload,
): Promise<void> {
    await storage.setItem(STARRED_ENTRIES_KEY, JSON.stringify(payload));
}

function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

export function listStarredEntryIds(): Promise<string[]> {
    return runAccountBoundOperation('starred-list', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        assertAccountOperationActive(context);
        const payload = await readPayload(storage);
        assertAccountOperationActive(context);
        return payload.ids;
    });
}

/** Add or remove one id. Returns the resulting list. */
export function toggleStarredEntry(id: string): Promise<string[]> {
    return runAccountBoundOperation('starred-toggle', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        return enqueueMutation(async () => {
            assertAccountOperationActive(context);
            const payload = await readPayload(storage);
            const ids = new Set(payload.ids);
            if (ids.has(id)) ids.delete(id);
            else ids.add(id);
            const next: StarredPayload = {
                schemaVersion: SCHEMA_VERSION,
                ids: [...ids],
                updatedAt: Date.now(),
            };
            await writePayload(storage, next);
            notifyStarredChanged(next.ids);
            assertAccountOperationActive(context);
            return next.ids;
        });
    });
}

/** Test/local-restore helper: replace the whole list in one locked write. */
export function setStarredEntryIds(ids: readonly string[]): Promise<string[]> {
    return runAccountBoundOperation('starred-set', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        return enqueueMutation(async () => {
            assertAccountOperationActive(context);
            const next: StarredPayload = {
                schemaVersion: SCHEMA_VERSION,
                ids: normalizeIds([...ids]),
                updatedAt: Date.now(),
            };
            await writePayload(storage, next);
            notifyStarredChanged(next.ids);
            return next.ids;
        });
    });
}
