/**
 * Starters the writer actually finished (Kaneo #85).
 *
 * One storage key, one owner. A starter counts as written only when a journal
 * entry was saved from it — a tap on the shelf never counts. A schemaVersion
 * envelope, serialized mutations and a safe parse keep this store honest.
 */
import { AccountStorageAdapter, getStorageForAccount } from '@/services/account/accountScopedStorage';
import {
    assertAccountOperationActive,
    registerAccountTeardown,
    runAccountBoundOperation,
} from '@/services/account/accountRuntime';
import { normalizeWrittenStarterIds } from '@/utils/promptPacks';

export const WRITTEN_STARTERS_KEY = '@blackrose_written_prompt_starters';

const SCHEMA_VERSION = 1;

interface WrittenStartersPayload {
    schemaVersion: number;
    ids: string[];
    updatedAt: number;
}

function emptyPayload(): WrittenStartersPayload {
    return { schemaVersion: SCHEMA_VERSION, ids: [], updatedAt: 0 };
}

let mutationQueue: Promise<void> = Promise.resolve();

type WrittenStartersListener = (ids: readonly string[]) => void;
const changeListeners = new Set<WrittenStartersListener>();

/** Screens subscribe instead of polling, so a finished entry lands at once. */
export function subscribeWrittenStarters(listener: WrittenStartersListener): () => void {
    changeListeners.add(listener);
    return () => { changeListeners.delete(listener); };
}

function notifyWrittenStarters(ids: readonly string[]): void {
    changeListeners.forEach((listener) => {
        try { listener(ids); } catch { /* one bad listener must not block the rest */ }
    });
}

registerAccountTeardown(() => { mutationQueue = Promise.resolve(); });

/** Safe parse: a corrupt, older or hostile payload never throws into the UI. */
function parsePayload(raw: string | null): WrittenStartersPayload {
    if (!raw) return emptyPayload();
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyPayload();
        const record = parsed as Record<string, unknown>;
        return {
            schemaVersion: typeof record.schemaVersion === 'number' ? record.schemaVersion : SCHEMA_VERSION,
            ids: [...normalizeWrittenStarterIds(record.ids)],
            updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : 0,
        };
    } catch {
        return emptyPayload();
    }
}

async function readPayload(storage: AccountStorageAdapter): Promise<WrittenStartersPayload> {
    return parsePayload(await storage.getItem(WRITTEN_STARTERS_KEY));
}

async function writePayload(storage: AccountStorageAdapter, payload: WrittenStartersPayload): Promise<void> {
    await storage.setItem(WRITTEN_STARTERS_KEY, JSON.stringify(payload));
}

function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

/** Read the written starters. Missing or corrupt storage returns an empty list. */
export function listWrittenStarters(): Promise<readonly string[]> {
    return runAccountBoundOperation('written-starters-list', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        assertAccountOperationActive(context);
        const payload = await readPayload(storage);
        assertAccountOperationActive(context);
        return payload.ids;
    });
}

/**
 * Mark one starter as written. Unknown ids are refused, duplicates are a no-op
 * (no new write), and the write is serialized so two finishes cannot drop one.
 * Progress is monotonic: finishing an entry never un-writes a starter.
 */
export function markStarterWritten(id: string): Promise<readonly string[]> {
    return runAccountBoundOperation('written-starters-mark', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        return enqueueMutation(async () => {
            assertAccountOperationActive(context);
            const current = await readPayload(storage);
            const safe = normalizeWrittenStarterIds([id]);
            if (safe.length === 0) return current.ids;
            if (current.ids.includes(safe[0])) return current.ids;
            const next = [...current.ids, safe[0]];
            await writePayload(storage, { schemaVersion: SCHEMA_VERSION, ids: next, updatedAt: Date.now() });
            notifyWrittenStarters(next);
            assertAccountOperationActive(context);
            return next;
        });
    });
}

/**
 * Clear History entry point. Writes an empty envelope (not removeItem) so the
 * key stays owned by this module and its shape stays valid, then notifies
 * subscribers so an open shelf cannot keep showing old progress forever.
 */
export function clearWrittenStarters(): Promise<void> {
    return runAccountBoundOperation('written-starters-clear', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        await enqueueMutation(async () => {
            assertAccountOperationActive(context);
            await writePayload(storage, { ...emptyPayload(), updatedAt: Date.now() });
            notifyWrittenStarters([]);
        });
    });
}

