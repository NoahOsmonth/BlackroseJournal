/**
 * Saved starting points (Kaneo #83).
 *
 * One storage key, one owner (AGENTS.md storage-key table). A schemaVersion
 * envelope keeps a future shape migratable; every mutation goes through this
 * module's serialized queue because AsyncStorage has no transactions and two
 * interleaved read-modify-write cycles would silently drop one side.
 */
import { AccountStorageAdapter, getStorageForAccount } from '@/services/account/accountScopedStorage';
import {
    assertAccountOperationActive,
    registerAccountTeardown,
    runAccountBoundOperation,
} from '@/services/account/accountRuntime';
import { normalizeSavedPromptIds } from '@/utils/promptPacks';

export const SAVED_STARTERS_KEY = '@blackrose_saved_prompt_starters';

const SCHEMA_VERSION = 1;

interface SavedStartersPayload {
    schemaVersion: number;
    ids: string[];
    updatedAt: number;
}

function emptyPayload(): SavedStartersPayload {
    return { schemaVersion: SCHEMA_VERSION, ids: [], updatedAt: 0 };
}

let mutationQueue: Promise<void> = Promise.resolve();

type SavedStartersListener = (ids: readonly string[]) => void;
const changeListeners = new Set<SavedStartersListener>();

/** Screens subscribe instead of polling on focus, so a favorite lands at once. */
export function subscribeSavedStarters(listener: SavedStartersListener): () => void {
    changeListeners.add(listener);
    return () => { changeListeners.delete(listener); };
}

function notifySavedStarters(ids: readonly string[]): void {
    changeListeners.forEach((listener) => {
        try { listener(ids); } catch { /* one bad listener must not break a write */ }
    });
}

registerAccountTeardown(() => { mutationQueue = Promise.resolve(); });

/** Safe parse: a corrupt, older or hostile payload never throws into the UI. */
function parsePayload(raw: string | null): SavedStartersPayload {
    if (!raw) return emptyPayload();
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyPayload();
        const record = parsed as Record<string, unknown>;
        return {
            schemaVersion: typeof record.schemaVersion === 'number' ? record.schemaVersion : SCHEMA_VERSION,
            ids: [...normalizeSavedPromptIds(record.ids)],
            updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : 0,
        };
    } catch {
        return emptyPayload();
    }
}

async function readPayload(storage: AccountStorageAdapter): Promise<SavedStartersPayload> {
    return parsePayload(await storage.getItem(SAVED_STARTERS_KEY));
}

async function writePayload(storage: AccountStorageAdapter, payload: SavedStartersPayload): Promise<void> {
    await storage.setItem(SAVED_STARTERS_KEY, JSON.stringify(payload));
}

function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

/** Read the saved favorites. Missing or corrupt storage returns an empty list. */
export function listSavedStarters(): Promise<readonly string[]> {
    return runAccountBoundOperation('saved-starters-list', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        assertAccountOperationActive(context);
        const payload = await readPayload(storage);
        assertAccountOperationActive(context);
        return payload.ids;
    });
}

/** Add or remove one favorite. Unknown ids are refused rather than stored. */
export function toggleSavedStarter(id: string): Promise<readonly string[]> {
    return runAccountBoundOperation('saved-starters-toggle', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        return enqueueMutation(async () => {
            assertAccountOperationActive(context);
            const current = await readPayload(storage);
            const safe = normalizeSavedPromptIds([id]);
            if (safe.length === 0) return current.ids;
            const next = current.ids.includes(safe[0])
                ? current.ids.filter((existing) => existing !== safe[0])
                : [...current.ids, safe[0]];
            await writePayload(storage, { schemaVersion: SCHEMA_VERSION, ids: next, updatedAt: Date.now() });
            notifySavedStarters(next);
            assertAccountOperationActive(context);
            return next;
        });
    });
}

/**
 * Clear History entry point. Writes an empty envelope (not removeItem) so the
 * key stays owned by this module and its shape stays valid, then notifies
 * subscribers so an open shelf cannot keep showing old favorites forever.
 */
export function clearSavedStarters(): Promise<void> {
    return runAccountBoundOperation('saved-starters-clear', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        await enqueueMutation(async () => {
            assertAccountOperationActive(context);
            await writePayload(storage, { ...emptyPayload(), updatedAt: Date.now() });
            notifySavedStarters([]);
        });
    });
}
