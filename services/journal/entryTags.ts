/**
 * Writer-chosen labels on journal entries (Kaneo #88, 2026 Search/Tags/Review).
 *
 * ONE storage key, ONE owner. The payload has a schemaVersion envelope so a
 * future shape can migrate instead of being misread. Every mutation goes
 * through the module's serialized queue because AsyncStorage has no
 * transactions and two interleaved read-modify-write cycles would silently
 * drop one side's label. Backups and Clear History go through THIS module too,
 * so the hook never holds a value that a direct write made stale.
 */

import { AccountStorageAdapter, getStorageForAccount } from '@/services/account/accountScopedStorage';
import {
    assertAccountOperationActive,
    registerAccountTeardown,
    runAccountBoundOperation,
    type AccountOperationContext,
} from '@/services/account/accountRuntime';
import { normalizeTag } from '@/utils/entryTags';

export const ENTRY_TAGS_KEY = '@blackrose_entry_tags';

const SCHEMA_VERSION = 1;
const MAX_LABELS_PER_ENTRY = 12;
const MAX_LABEL_LENGTH = 40;

/** entry id -> canonical labels (trimmed, lower-cased, de-duplicated). */
export type EntryTagMap = Readonly<Record<string, readonly string[]>>;

interface EntryTagsPayload {
    schemaVersion: number;
    byEntry: Record<string, string[]>;
    updatedAt: number;
}

const EMPTY: EntryTagsPayload = { schemaVersion: SCHEMA_VERSION, byEntry: {}, updatedAt: 0 };

let mutationQueue: Promise<void> = Promise.resolve();

type EntryTagsListener = (tags: EntryTagMap) => void;
const changeListeners = new Set<EntryTagsListener>();

export function subscribeEntryTagChanges(listener: EntryTagsListener): () => void {
    changeListeners.add(listener);
    return () => { changeListeners.delete(listener); };
}

function notifyEntryTagsChanged(tags: EntryTagMap): void {
    changeListeners.forEach((listener) => {
        try {
            listener(tags);
        } catch {
            // One broken listener must never break a storage write.
        }
    });
}

registerAccountTeardown(() => {
    mutationQueue = Promise.resolve();
    notifyEntryTagsChanged({});
});

function toMap(payload: EntryTagsPayload): EntryTagMap {
    const map: Record<string, readonly string[]> = {};
    Object.entries(payload.byEntry).forEach(([id, tags]) => {
        if (tags.length > 0) map[id] = tags;
    });
    return map;
}

function normalizeMap(value: unknown): Record<string, string[]> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const result: Record<string, string[]> = {};
    Object.entries(value as Record<string, unknown>).forEach(([id, raw]) => {
        if (typeof id !== 'string' || id.length === 0 || !Array.isArray(raw)) return;
        const tags: string[] = [];
        for (const item of raw) {
            if (typeof item !== 'string') continue;
            const tag = normalizeTag(item);
            if (tag.length === 0 || tags.includes(tag)) continue;
            tags.push(tag);
            if (tags.length >= MAX_LABELS_PER_ENTRY) break;
        }
        if (tags.length > 0) result[id] = tags;
    });
    return result;
}

/** Safe parse: a corrupt or older payload never throws into the UI. */
function parsePayload(raw: string | null): EntryTagsPayload {
    if (!raw) return EMPTY;
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object') return EMPTY;
        const record = parsed as Record<string, unknown>;
        const byEntry = normalizeMap(record.byEntry);
        return {
            schemaVersion: typeof record.schemaVersion === 'number' ? record.schemaVersion : SCHEMA_VERSION,
            byEntry,
            updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : 0,
        };
    } catch {
        return EMPTY;
    }
}

async function readPayload(storage: AccountStorageAdapter): Promise<EntryTagsPayload> {
    return parsePayload(await storage.getItem(ENTRY_TAGS_KEY));
}

async function writePayload(storage: AccountStorageAdapter, byEntry: Record<string, string[]>): Promise<EntryTagMap> {
    // Normalize on the way IN, not only on read. A rename that merges into an
    // existing label would otherwise store the same label twice, and a reader
    // silently de-duplicating it hid that from the tests.
    const payload: EntryTagsPayload = {
        schemaVersion: SCHEMA_VERSION,
        byEntry: normalizeMap(byEntry),
        updatedAt: Date.now(),
    };
    await storage.setItem(ENTRY_TAGS_KEY, JSON.stringify(payload));
    const map = toMap(payload);
    notifyEntryTagsChanged(map);
    return map;
}

function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

export function listEntryTags(): Promise<EntryTagMap> {
    return runAccountBoundOperation('entry-tags-list', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        assertAccountOperationActive(context);
        const payload = await readPayload(storage);
        assertAccountOperationActive(context);
        return toMap(payload);
    });
}

export function getEntryTags(entryId: string): Promise<readonly string[]> {
    return listEntryTags().then((map) => map[entryId] ?? []);
}

/** Replace one entry's labels in one locked write. Ignores an empty label. */
export function setEntryTags(entryId: string, labels: readonly string[]): Promise<EntryTagMap> {
    return runAccountBoundOperation('entry-tags-set', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        return enqueueMutation(async () => {
            assertAccountOperationActive(context);
            const payload = await readPayload(storage);
            const next = normalizeMap({ ...payload.byEntry, [entryId]: [...labels] });
            if (next[entryId]) {
                next[entryId] = next[entryId].filter((tag) => tag.length <= MAX_LABEL_LENGTH);
            }
            return writePayload(storage, next);
        });
    });
}

export function addEntryTag(entryId: string, label: string): Promise<EntryTagMap> {
    return runAccountBoundOperation('entry-tags-add', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        return enqueueMutation(async () => {
            assertAccountOperationActive(context);
            const tag = normalizeTag(label);
            if (tag.length === 0 || tag.length > MAX_LABEL_LENGTH || entryId.length === 0) {
                return toMap(await readPayload(storage));
            }
            const payload = await readPayload(storage);
            const current = payload.byEntry[entryId] ?? [];
            if (current.includes(tag) || current.length >= MAX_LABELS_PER_ENTRY) {
                return toMap(payload);
            }
            const next = { ...payload.byEntry, [entryId]: [...current, tag] };
            return writePayload(storage, next);
        });
    });
}

export function removeEntryTag(entryId: string, label: string): Promise<EntryTagMap> {
    return runAccountBoundOperation('entry-tags-remove', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        return enqueueMutation(async () => {
            assertAccountOperationActive(context);
            const payload = await readPayload(storage);
            const current = payload.byEntry[entryId] ?? [];
            const tag = normalizeTag(label);
            const kept = current.filter((item) => item !== tag);
            if (kept.length === current.length) return toMap(payload);
            const next = { ...payload.byEntry };
            if (kept.length === 0) delete next[entryId];
            else next[entryId] = kept;
            return writePayload(storage, next);
        });
    });
}

/**
 * Rename one label across the whole journal, merging into the target when it
 * already exists. Without this a typo is permanent: the only escape would be
 * opening every entry and removing it by hand.
 */
export function renameEntryTag(from: string, to: string): Promise<EntryTagMap> {
    return runAccountBoundOperation('entry-tags-rename', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        return enqueueMutation(async () => {
            assertAccountOperationActive(context);
            const source = normalizeTag(from);
            const target = normalizeTag(to);
            const payload = await readPayload(storage);
            // An empty name would delete the label and a too-long one would be
            // trimmed on write; refuse both instead of half-applying a rename.
            if (source.length === 0 || target.length === 0 || target.length > MAX_LABEL_LENGTH || source === target) {
                return toMap(payload);
            }
            const next: Record<string, string[]> = {};
            let changed = false;
            Object.entries(payload.byEntry).forEach(([entryId, tags]) => {
                if (!tags.includes(source)) {
                    next[entryId] = [...tags];
                    return;
                }
                changed = true;
                // writePayload normalizes on write, so merging into an existing
                // label cannot leave the same label twice on one entry.
                next[entryId] = tags.map((tag) => (tag === source ? target : tag));
            });
            if (!changed) return toMap(payload);
            return writePayload(storage, next);
        });
    });
}

/**
 * Delete one label for good: drop it from every entry. Entries left with no
 * labels lose their key entirely, so the chip row cannot show an empty label.
 */
export function deleteEntryTag(label: string): Promise<EntryTagMap> {
    return runAccountBoundOperation('entry-tags-delete', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        return enqueueMutation(async () => {
            assertAccountOperationActive(context);
            const victim = normalizeTag(label);
            if (victim.length === 0) return toMap(await readPayload(storage));
            const payload = await readPayload(storage);
            const next: Record<string, string[]> = {};
            let changed = false;
            Object.entries(payload.byEntry).forEach(([entryId, tags]) => {
                if (!tags.includes(victim)) {
                    next[entryId] = [...tags];
                    return;
                }
                changed = true;
                const kept = tags.filter((tag) => tag !== victim);
                if (kept.length > 0) next[entryId] = kept;
            });
            if (!changed) return toMap(payload);
            return writePayload(storage, next);
        });
    });
}

/** Clear History: an empty envelope keeps the key owned and its shape valid. */
export function clearAllEntryTags(): Promise<void> {
    return runAccountBoundOperation('entry-tags-clear', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        await enqueueMutation(async () => {
            assertAccountOperationActive(context);
            await writePayload(storage, {});
        });
    });
}

/** Test / local-restore helper: replace the whole map in one locked write. */
export function setEntryTagMap(map: EntryTagMap): Promise<EntryTagMap> {
    return runAccountBoundOperation('entry-tags-set-map', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        return enqueueMutation(async () => {
            assertAccountOperationActive(context);
            return writePayload(storage, normalizeMap(map));
        });
    });
}

/** Backup restore delegates through this owner, so subscribers stay fresh. */
export function importEntryTagsSnapshot(
    value: string | null,
    delegate?: (context: AccountOperationContext) => Promise<void>,
): Promise<void> {
    return runAccountBoundOperation('entry-tags-import', async (context) => {
        await enqueueMutation(async () => {
            assertAccountOperationActive(context);
            await (delegate ?? importEntryTagsForAccount)(context, value);
            const storage = getStorageForAccount(context.accountId);
            notifyEntryTagsChanged(toMap(await readPayload(storage)));
            assertAccountOperationActive(context);
        });
    });
}

export async function importEntryTagsForAccount(
    context: AccountOperationContext,
    value: string | null,
): Promise<void> {
    const storage = getStorageForAccount(context.accountId);
    const payload = parsePayload(value);
    await writePayload(storage, payload.byEntry);
}
