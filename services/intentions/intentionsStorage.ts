/**
 * Intentions storage service
 * Handles local persistence + remote sync for intentions and check-ins.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    Intention,
    IntentionCheckIn,
    IntentionCheckInCreateInput,
    IntentionCheckInUpdateInput,
    IntentionCreateInput,
    IntentionUpdateInput,
} from './intentionsStorage.types';
import {
    fetchRemoteCheckIns,
    fetchRemoteIntentions,
    mergeCheckIns,
    mergeIntentions,
    pushCheckIns,
    pushIntentions,
    queueCheckInDelete,
    queueCheckInUpsert,
    queueIntentionDelete,
    queueIntentionUpsert,
} from './intentionsRemote';
import { upsertCheckInDayDigest } from '../memory/dayDigestStorage';
import { extractIdentityFromSessionTranscript } from '../memory/identityExtraction';
import { retainCheckInToHindsight } from '../memory/hindsight/hindsightRetain';
import { saveIntentionCheckInMemories } from '../memory/localMemory';
import { buildAndSaveSessionDigest } from '../memory/sessionDigestBuild';
import {
    AccountStorageAdapter,
    claimLegacyStorageKey,
    getStorageForAccount,
} from '@/services/account/accountScopedStorage';
import {
    AccountOperationContext,
    assertAccountOperationActive,
    registerAccountTeardown,
    runAccountBoundOperation,
} from '@/services/account/accountRuntime';

const INTENTIONS_KEY = '@intentions';
const CHECKINS_KEY = '@intention_checkins';

let hasPulledIntentions = false;
let hasPushedIntentions = false;
let hasPulledCheckIns = false;
let hasPushedCheckIns = false;

let intentionsSyncPromise: Promise<void> | null = null;
let checkInsSyncPromise: Promise<void> | null = null;
let mutationQueue: Promise<void> = Promise.resolve();

function generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function loadMap<T>(
    storage: AccountStorageAdapter,
    key: string,
): Promise<Record<string, T>> {
    const json = await storage.getItem(key);
    if (!json) return {};
    try {
        const parsed = JSON.parse(json) as unknown;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed as Record<string, T>
            : {};
    } catch {
        return {};
    }
}

async function saveMap<T>(
    storage: AccountStorageAdapter,
    key: string,
    data: Record<string, T>,
): Promise<void> {
    await storage.setItem(key, JSON.stringify(data));
}

function withMutationLock<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

async function syncIntentionsFromRemoteIfNeeded(
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<void> {
    if (intentionsSyncPromise) {
        return intentionsSyncPromise;
    }

    intentionsSyncPromise = (async () => {
        const local = await loadMap<Intention>(storage, INTENTIONS_KEY);
        assertAccountOperationActive(context);
        const hasLocal = Object.keys(local).length > 0;

        if (!hasLocal && !hasPulledIntentions) {
            const remote = await fetchRemoteIntentions(context);
            assertAccountOperationActive(context);
            if (remote) {
                hasPulledIntentions = true;
                await withMutationLock(async () => {
                    assertAccountOperationActive(context);
                    const latest = await loadMap<Intention>(storage, INTENTIONS_KEY);
                    assertAccountOperationActive(context);
                    await saveMap(storage, INTENTIONS_KEY, mergeIntentions(latest, remote));
                    assertAccountOperationActive(context);
                });
            }
        }

        if (hasLocal && !hasPushedIntentions) {
            try {
                const pushed = await pushIntentions(Object.values(local), context);
                assertAccountOperationActive(context);
                if (pushed) {
                    hasPushedIntentions = true;
                }
            } catch (error) {
                if (context.signal.aborted) throw error;
                console.warn('Failed to push intentions:', error);
            }
        }
    })();

    try {
        await intentionsSyncPromise;
    } finally {
        intentionsSyncPromise = null;
    }
}

async function syncCheckInsFromRemoteIfNeeded(
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<void> {
    if (checkInsSyncPromise) {
        return checkInsSyncPromise;
    }

    checkInsSyncPromise = (async () => {
        const local = await loadMap<IntentionCheckIn>(storage, CHECKINS_KEY);
        assertAccountOperationActive(context);
        const hasLocal = Object.keys(local).length > 0;

        if (!hasLocal && !hasPulledCheckIns) {
            const remote = await fetchRemoteCheckIns(context);
            assertAccountOperationActive(context);
            if (remote) {
                hasPulledCheckIns = true;
                await withMutationLock(async () => {
                    assertAccountOperationActive(context);
                    const latest = await loadMap<IntentionCheckIn>(storage, CHECKINS_KEY);
                    assertAccountOperationActive(context);
                    await saveMap(storage, CHECKINS_KEY, mergeCheckIns(latest, remote));
                    assertAccountOperationActive(context);
                });
            }
        }

        if (hasLocal && !hasPushedCheckIns) {
            try {
                const pushed = await pushCheckIns(Object.values(local), context);
                assertAccountOperationActive(context);
                if (pushed) {
                    hasPushedCheckIns = true;
                }
            } catch (error) {
                if (context.signal.aborted) throw error;
                console.warn('Failed to push check-ins:', error);
            }
        }
    })();

    try {
        await checkInsSyncPromise;
    } finally {
        checkInsSyncPromise = null;
    }
}

export function listIntentions(): Promise<Intention[]> {
    return runAccountBoundOperation('intentions-list', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        await syncIntentionsFromRemoteIfNeeded(storage, context);
        assertAccountOperationActive(context);
        const map = await loadMap<Intention>(storage, INTENTIONS_KEY);
        assertAccountOperationActive(context);
        return Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
    });
}

export function getIntention(id: string): Promise<Intention | null> {
    return runAccountBoundOperation('intentions-get', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        await syncIntentionsFromRemoteIfNeeded(storage, context);
        assertAccountOperationActive(context);
        const map = await loadMap<Intention>(storage, INTENTIONS_KEY);
        assertAccountOperationActive(context);
        return map[id] ?? null;
    });
}

async function queueIntentionUpsertForAccount(
    intention: Intention,
    context: AccountOperationContext,
): Promise<void> {
    try {
        assertAccountOperationActive(context);
        await queueIntentionUpsert(intention, context);
        assertAccountOperationActive(context);
    } catch (error) {
        if (context.signal.aborted) throw error;
        console.warn('Failed to queue intention sync:', error);
    }
}

async function queueIntentionDeleteForAccount(
    id: string,
    context: AccountOperationContext,
): Promise<void> {
    try {
        assertAccountOperationActive(context);
        await queueIntentionDelete(id, context);
        assertAccountOperationActive(context);
    } catch (error) {
        if (context.signal.aborted) throw error;
        console.warn('Failed to queue intention delete:', error);
    }
}

export function createIntention(input: IntentionCreateInput): Promise<Intention> {
    return runAccountBoundOperation('intentions-create', async (context) => {
        const now = Date.now();
        const intention: Intention = {
            id: generateId('intention'),
            title: input.title.trim(),
            description: input.description.trim(),
            area: input.area,
            iconKey: input.iconKey,
            imageKey: input.imageKey,
            isArchived: false,
            createdAt: now,
            updatedAt: now,
        };
        const storage = getStorageForAccount(context.accountId);

        await withMutationLock(async () => {
            assertAccountOperationActive(context);
            const map = await loadMap<Intention>(storage, INTENTIONS_KEY);
            assertAccountOperationActive(context);
            map[intention.id] = intention;
            await saveMap(storage, INTENTIONS_KEY, map);
            assertAccountOperationActive(context);
        });
        assertAccountOperationActive(context);
        await queueIntentionUpsertForAccount(intention, context);
        return intention;
    });
}

export function updateIntention(
    id: string,
    updates: IntentionUpdateInput
): Promise<Intention | null> {
    return runAccountBoundOperation('intentions-update', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        const updated = await withMutationLock(async () => {
            assertAccountOperationActive(context);
            const map = await loadMap<Intention>(storage, INTENTIONS_KEY);
            assertAccountOperationActive(context);
            const existing = map[id];
            if (!existing) return null;
            const next: Intention = {
                ...existing,
                ...updates,
                updatedAt: Date.now(),
            };
            map[id] = next;
            await saveMap(storage, INTENTIONS_KEY, map);
            assertAccountOperationActive(context);
            return next;
        });
        assertAccountOperationActive(context);
        if (!updated) return null;

        await queueIntentionUpsertForAccount(updated, context);
        return updated;
    });
}

export async function archiveIntention(id: string): Promise<Intention | null> {
    return updateIntention(id, { isArchived: true });
}

export function deleteIntention(id: string): Promise<boolean> {
    return runAccountBoundOperation('intentions-delete', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        const deleted = await withMutationLock(async () => {
            assertAccountOperationActive(context);
            const map = await loadMap<Intention>(storage, INTENTIONS_KEY);
            assertAccountOperationActive(context);
            if (!map[id]) return false;
            delete map[id];
            await saveMap(storage, INTENTIONS_KEY, map);
            assertAccountOperationActive(context);
            return true;
        });
        assertAccountOperationActive(context);
        if (!deleted) return false;

        await queueIntentionDeleteForAccount(id, context);
        return true;
    });
}

export function listCheckIns(): Promise<IntentionCheckIn[]> {
    return runAccountBoundOperation('check-ins-list', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        await syncCheckInsFromRemoteIfNeeded(storage, context);
        assertAccountOperationActive(context);
        const map = await loadMap<IntentionCheckIn>(storage, CHECKINS_KEY);
        assertAccountOperationActive(context);
        return Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
    });
}

export function getCheckIn(id: string): Promise<IntentionCheckIn | null> {
    return runAccountBoundOperation('check-ins-get', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        await syncCheckInsFromRemoteIfNeeded(storage, context);
        assertAccountOperationActive(context);
        const map = await loadMap<IntentionCheckIn>(storage, CHECKINS_KEY);
        assertAccountOperationActive(context);
        return map[id] ?? null;
    });
}

export async function listCheckInsByIntention(intentionId: string): Promise<IntentionCheckIn[]> {
    const list = await listCheckIns();
    return list.filter((item) => item.intentionId === intentionId);
}

export async function listCheckInDrafts(): Promise<IntentionCheckIn[]> {
    const list = await listCheckIns();
    return list.filter((item) => item.status === 'draft');
}

export async function listCompletedCheckIns(): Promise<IntentionCheckIn[]> {
    const list = await listCheckIns();
    return list.filter((item) => item.status === 'completed');
}

async function queueCheckInUpsertForAccount(
    checkIn: IntentionCheckIn,
    context: AccountOperationContext,
): Promise<void> {
    try {
        assertAccountOperationActive(context);
        await queueCheckInUpsert(checkIn, context);
        assertAccountOperationActive(context);
    } catch (error) {
        if (context.signal.aborted) throw error;
        console.warn('Failed to queue check-in sync:', error);
    }
}

async function queueCheckInDeleteForAccount(
    id: string,
    context: AccountOperationContext,
): Promise<void> {
    try {
        assertAccountOperationActive(context);
        await queueCheckInDelete(id, context);
        assertAccountOperationActive(context);
    } catch (error) {
        if (context.signal.aborted) throw error;
        console.warn('Failed to queue check-in delete:', error);
    }
}

async function runCompletedCheckInSideEffects(
    checkIn: IntentionCheckIn,
    context: AccountOperationContext,
): Promise<void> {
    try {
        assertAccountOperationActive(context);
        await saveIntentionCheckInMemories(checkIn);
        assertAccountOperationActive(context);
    } catch (error) {
        if (context.signal.aborted) throw error;
        console.warn('Failed to save check-in memories:', error);
    }

    try {
        assertAccountOperationActive(context);
        await upsertCheckInDayDigest(checkIn);
        assertAccountOperationActive(context);
    } catch (error) {
        if (context.signal.aborted) throw error;
        console.warn('Failed to update day digest for check-in:', error);
    }

    const userLines = (checkIn.messages ?? [])
        .filter((m) => m.role === 'user')
        .map((m) => m.content);

    // These remain fire-and-forget, but each call acquires its own account lease
    // synchronously and therefore is cancelled by the same account switch.
    try {
        assertAccountOperationActive(context);
        void extractIdentityFromSessionTranscript(userLines).catch((error) => {
            console.warn('Failed to extract identity from check-in:', error);
        });
        assertAccountOperationActive(context);
        void buildAndSaveSessionDigest({
            sessionId: checkIn.id,
            sourceKind: 'intention_checkin',
            sourceId: checkIn.id,
            userMessages: userLines,
        }).catch((error) => {
            console.warn('Failed to build session digest for check-in:', error);
        });
        assertAccountOperationActive(context);
        void retainCheckInToHindsight(checkIn).catch((error) => {
            console.warn('Hindsight retain failed (check-in):', error);
        });
    } catch (error) {
        if (context.signal.aborted) throw error;
        console.warn('Failed to start check-in side effects:', error);
    }
}

export function createCheckIn(
    input: IntentionCheckInCreateInput
): Promise<IntentionCheckIn> {
    return runAccountBoundOperation('check-ins-create', async (context) => {
        const now = Date.now();
        const createdAt = typeof input.createdAt === 'number' && Number.isFinite(input.createdAt)
            ? input.createdAt
            : now;
        const updatedAt = typeof input.updatedAt === 'number' && Number.isFinite(input.updatedAt)
            ? input.updatedAt
            : createdAt;
        const checkIn: IntentionCheckIn = {
            id: generateId('checkin'),
            intentionId: input.intentionId,
            type: input.type,
            title: input.title.trim(),
            summary: input.summary.trim(),
            mood: input.mood,
            personaId: input.personaId,
            messages: input.messages ?? [],
            status: input.status,
            createdAt,
            updatedAt,
        };
        const storage = getStorageForAccount(context.accountId);

        await withMutationLock(async () => {
            assertAccountOperationActive(context);
            const map = await loadMap<IntentionCheckIn>(storage, CHECKINS_KEY);
            assertAccountOperationActive(context);
            map[checkIn.id] = checkIn;
            await saveMap(storage, CHECKINS_KEY, map);
            assertAccountOperationActive(context);
        });
        assertAccountOperationActive(context);
        await queueCheckInUpsertForAccount(checkIn, context);

        if (checkIn.status === 'completed') {
            await runCompletedCheckInSideEffects(checkIn, context);
        }

        return checkIn;
    });
}

export function updateCheckIn(
    id: string,
    updates: IntentionCheckInUpdateInput
): Promise<IntentionCheckIn | null> {
    return runAccountBoundOperation('check-ins-update', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        const updated = await withMutationLock(async () => {
            assertAccountOperationActive(context);
            const map = await loadMap<IntentionCheckIn>(storage, CHECKINS_KEY);
            assertAccountOperationActive(context);
            const existing = map[id];
            if (!existing) return null;
            const next: IntentionCheckIn = {
                ...existing,
                ...updates,
                title: updates.title ? updates.title.trim() : existing.title,
                summary: updates.summary ? updates.summary.trim() : existing.summary,
                updatedAt: Date.now(),
            };
            map[id] = next;
            await saveMap(storage, CHECKINS_KEY, map);
            assertAccountOperationActive(context);
            return next;
        });
        assertAccountOperationActive(context);
        if (!updated) return null;

        await queueCheckInUpsertForAccount(updated, context);
        if (updated.status === 'completed') {
            await runCompletedCheckInSideEffects(updated, context);
        }
        return updated;
    });
}

export function deleteCheckIn(id: string): Promise<boolean> {
    return runAccountBoundOperation('check-ins-delete', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        const deleted = await withMutationLock(async () => {
            assertAccountOperationActive(context);
            const map = await loadMap<IntentionCheckIn>(storage, CHECKINS_KEY);
            assertAccountOperationActive(context);
            if (!map[id]) return false;
            delete map[id];
            await saveMap(storage, CHECKINS_KEY, map);
            assertAccountOperationActive(context);
            return true;
        });
        assertAccountOperationActive(context);
        if (!deleted) return false;

        await queueCheckInDeleteForAccount(id, context);
        return true;
    });
}

export function clearAllIntentions(): Promise<void> {
    return runAccountBoundOperation('intentions-clear', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        const ids = await withMutationLock(async () => {
            assertAccountOperationActive(context);
            const map = await loadMap<Intention>(storage, INTENTIONS_KEY);
            assertAccountOperationActive(context);
            await storage.removeItem(INTENTIONS_KEY);
            assertAccountOperationActive(context);
            return Object.keys(map);
        });
        assertAccountOperationActive(context);
        await Promise.all(ids.map((id) => queueIntentionDeleteForAccount(id, context)));
        assertAccountOperationActive(context);
    });
}

export function clearAllCheckIns(): Promise<void> {
    return runAccountBoundOperation('check-ins-clear', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        const ids = await withMutationLock(async () => {
            assertAccountOperationActive(context);
            const map = await loadMap<IntentionCheckIn>(storage, CHECKINS_KEY);
            assertAccountOperationActive(context);
            await storage.removeItem(CHECKINS_KEY);
            assertAccountOperationActive(context);
            return Object.keys(map);
        });
        assertAccountOperationActive(context);
        await Promise.all(ids.map((id) => queueCheckInDeleteForAccount(id, context)));
        assertAccountOperationActive(context);
    });
}

export function migrateLegacyIntentionsToActiveAccount(): Promise<void> {
    return runAccountBoundOperation('intentions-legacy-migration', async (context) => {
        await withMutationLock(async () => {
            assertAccountOperationActive(context);
            await claimLegacyStorageKey(INTENTIONS_KEY);
            assertAccountOperationActive(context);
            await claimLegacyStorageKey(CHECKINS_KEY);
            assertAccountOperationActive(context);
        });
    });
}

export async function hasLegacyIntentions(): Promise<boolean> {
    const [intentions, checkIns] = await Promise.all([
        AsyncStorage.getItem(INTENTIONS_KEY),
        AsyncStorage.getItem(CHECKINS_KEY),
    ]);
    return intentions !== null || checkIns !== null;
}

async function importSnapshot<T>(
    storage: AccountStorageAdapter,
    key: string,
    value: string | null,
): Promise<void> {
    if (value === null) {
        await storage.removeItem(key);
        return;
    }
    let items: Record<string, T> = {};
    try {
        const parsed = JSON.parse(value) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            items = parsed as Record<string, T>;
        }
    } catch {
        // Corrupt backup payload restores the owner's safe empty default.
    }
    await saveMap(storage, key, items);
}

export function importIntentionsSnapshot(
    value: string | null,
    delegate?: (context: AccountOperationContext) => Promise<void>,
): Promise<void> {
    return runAccountBoundOperation('intentions-import', async (context) => {
        await withMutationLock(async () => {
            assertAccountOperationActive(context);
            await (delegate ?? importSnapshotForAccount<Intention>)(context, INTENTIONS_KEY, value);
            assertAccountOperationActive(context);
        });
    });
}

export async function importSnapshotForAccount<T>(
    context: AccountOperationContext,
    key: string,
    value: string | null,
): Promise<void> {
    const storage = getStorageForAccount(context.accountId);
    await importSnapshot<T>(storage, key, value);
}

export function importCheckInsSnapshot(
    value: string | null,
    delegate?: (context: AccountOperationContext) => Promise<void>,
): Promise<void> {
    return runAccountBoundOperation('check-ins-import', async (context) => {
        await withMutationLock(async () => {
            assertAccountOperationActive(context);
            await (delegate ?? importSnapshotForAccount<IntentionCheckIn>)(context, CHECKINS_KEY, value);
            assertAccountOperationActive(context);
        });
    });
}

registerAccountTeardown(async () => {
    await mutationQueue;
    await Promise.all([
        intentionsSyncPromise?.catch(() => undefined),
        checkInsSyncPromise?.catch(() => undefined),
    ]);
    hasPulledIntentions = false;
    hasPushedIntentions = false;
    hasPulledCheckIns = false;
    hasPushedCheckIns = false;
    intentionsSyncPromise = null;
    checkInsSyncPromise = null;
});
