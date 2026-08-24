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
    claimLegacyStorageKey,
    getAccountScopedStorageKey,
} from '@/services/account/accountScopedStorage';
import { registerAccountTeardown } from '@/services/account/accountRuntime';

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

async function loadMap<T>(key: string): Promise<Record<string, T>> {
    const json = await AsyncStorage.getItem(getAccountScopedStorageKey(key));
    if (!json) return {};
    try {
        const parsed = JSON.parse(json) as unknown;
        return parsed && typeof parsed === 'object'
            ? parsed as Record<string, T>
            : {};
    } catch {
        return {};
    }
}

async function saveMap<T>(key: string, data: Record<string, T>): Promise<void> {
    await AsyncStorage.setItem(getAccountScopedStorageKey(key), JSON.stringify(data));
}

function withMutationLock<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

async function syncIntentionsFromRemoteIfNeeded(): Promise<void> {
    if (intentionsSyncPromise) {
        return intentionsSyncPromise;
    }

    intentionsSyncPromise = (async () => {
        const local = await loadMap<Intention>(INTENTIONS_KEY);
        const hasLocal = Object.keys(local).length > 0;

        if (!hasLocal && !hasPulledIntentions) {
            const remote = await fetchRemoteIntentions();
            if (remote) {
                hasPulledIntentions = true;
                await withMutationLock(async () => {
                    const latest = await loadMap<Intention>(INTENTIONS_KEY);
                    await saveMap(INTENTIONS_KEY, mergeIntentions(latest, remote));
                });
            }
        }

        if (hasLocal && !hasPushedIntentions) {
            try {
                const pushed = await pushIntentions(Object.values(local));
                if (pushed) {
                    hasPushedIntentions = true;
                }
            } catch (error) {
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

async function syncCheckInsFromRemoteIfNeeded(): Promise<void> {
    if (checkInsSyncPromise) {
        return checkInsSyncPromise;
    }

    checkInsSyncPromise = (async () => {
        const local = await loadMap<IntentionCheckIn>(CHECKINS_KEY);
        const hasLocal = Object.keys(local).length > 0;

        if (!hasLocal && !hasPulledCheckIns) {
            const remote = await fetchRemoteCheckIns();
            if (remote) {
                hasPulledCheckIns = true;
                await withMutationLock(async () => {
                    const latest = await loadMap<IntentionCheckIn>(CHECKINS_KEY);
                    await saveMap(CHECKINS_KEY, mergeCheckIns(latest, remote));
                });
            }
        }

        if (hasLocal && !hasPushedCheckIns) {
            try {
                const pushed = await pushCheckIns(Object.values(local));
                if (pushed) {
                    hasPushedCheckIns = true;
                }
            } catch (error) {
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

export async function listIntentions(): Promise<Intention[]> {
    await syncIntentionsFromRemoteIfNeeded();
    const map = await loadMap<Intention>(INTENTIONS_KEY);
    return Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getIntention(id: string): Promise<Intention | null> {
    await syncIntentionsFromRemoteIfNeeded();
    const map = await loadMap<Intention>(INTENTIONS_KEY);
    return map[id] ?? null;
}

export async function createIntention(input: IntentionCreateInput): Promise<Intention> {
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

    await withMutationLock(async () => {
        const map = await loadMap<Intention>(INTENTIONS_KEY);
        map[intention.id] = intention;
        await saveMap(INTENTIONS_KEY, map);
    });

    try {
        await queueIntentionUpsert(intention);
    } catch (error) {
        console.warn('Failed to queue intention sync:', error);
    }

    return intention;
}

export async function updateIntention(
    id: string,
    updates: IntentionUpdateInput
): Promise<Intention | null> {
    const updated = await withMutationLock(async () => {
        const map = await loadMap<Intention>(INTENTIONS_KEY);
        const existing = map[id];
        if (!existing) return null;
        const next: Intention = {
            ...existing,
            ...updates,
            updatedAt: Date.now(),
        };
        map[id] = next;
        await saveMap(INTENTIONS_KEY, map);
        return next;
    });
    if (!updated) return null;

    try {
        await queueIntentionUpsert(updated);
    } catch (error) {
        console.warn('Failed to queue intention sync:', error);
    }

    return updated;
}

export async function archiveIntention(id: string): Promise<Intention | null> {
    return updateIntention(id, { isArchived: true });
}

export async function deleteIntention(id: string): Promise<boolean> {
    const deleted = await withMutationLock(async () => {
        const map = await loadMap<Intention>(INTENTIONS_KEY);
        if (!map[id]) return false;
        delete map[id];
        await saveMap(INTENTIONS_KEY, map);
        return true;
    });
    if (!deleted) return false;

    try {
        await queueIntentionDelete(id);
    } catch (error) {
        console.warn('Failed to queue intention delete:', error);
    }

    return true;
}

export async function listCheckIns(): Promise<IntentionCheckIn[]> {
    await syncCheckInsFromRemoteIfNeeded();
    const map = await loadMap<IntentionCheckIn>(CHECKINS_KEY);
    return Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getCheckIn(id: string): Promise<IntentionCheckIn | null> {
    await syncCheckInsFromRemoteIfNeeded();
    const map = await loadMap<IntentionCheckIn>(CHECKINS_KEY);
    return map[id] ?? null;
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

export async function createCheckIn(
    input: IntentionCheckInCreateInput
): Promise<IntentionCheckIn> {
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

    await withMutationLock(async () => {
        const map = await loadMap<IntentionCheckIn>(CHECKINS_KEY);
        map[checkIn.id] = checkIn;
        await saveMap(CHECKINS_KEY, map);
    });

    try {
        await queueCheckInUpsert(checkIn);
    } catch (error) {
        console.warn('Failed to queue check-in sync:', error);
    }

    if (checkIn.status === 'completed') {
        try {
            await saveIntentionCheckInMemories(checkIn);
        } catch (error) {
            console.warn('Failed to save check-in memories:', error);
        }
        try {
            await upsertCheckInDayDigest(checkIn);
        } catch (error) {
            console.warn('Failed to update day digest for check-in:', error);
        }
        // Fire-and-forget — do not block check-in save on flash extract / digest.
        const userLines = (checkIn.messages ?? [])
            .filter((m) => m.role === 'user')
            .map((m) => m.content);
        void extractIdentityFromSessionTranscript(userLines).catch((error) => {
            console.warn('Failed to extract identity from check-in:', error);
        });
        void buildAndSaveSessionDigest({
            sessionId: checkIn.id,
            sourceKind: 'intention_checkin',
            sourceId: checkIn.id,
            userMessages: userLines,
        }).catch((error) => {
            console.warn('Failed to build session digest for check-in:', error);
        });
        void retainCheckInToHindsight(checkIn).catch((error) => {
            console.warn('Hindsight retain failed (check-in):', error);
        });
    }

    return checkIn;
}

export async function updateCheckIn(
    id: string,
    updates: IntentionCheckInUpdateInput
): Promise<IntentionCheckIn | null> {
    const updated = await withMutationLock(async () => {
        const map = await loadMap<IntentionCheckIn>(CHECKINS_KEY);
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
        await saveMap(CHECKINS_KEY, map);
        return next;
    });
    if (!updated) return null;

    try {
        await queueCheckInUpsert(updated);
    } catch (error) {
        console.warn('Failed to queue check-in sync:', error);
    }

    if (updated.status === 'completed') {
        try {
            await saveIntentionCheckInMemories(updated);
        } catch (error) {
            console.warn('Failed to save check-in memories:', error);
        }
        try {
            await upsertCheckInDayDigest(updated);
        } catch (error) {
            console.warn('Failed to update day digest for check-in:', error);
        }
        const userLines = (updated.messages ?? [])
            .filter((m) => m.role === 'user')
            .map((m) => m.content);
        void extractIdentityFromSessionTranscript(userLines).catch((error) => {
            console.warn('Failed to extract identity from check-in:', error);
        });
        void buildAndSaveSessionDigest({
            sessionId: updated.id,
            sourceKind: 'intention_checkin',
            sourceId: updated.id,
            userMessages: userLines,
        }).catch((error) => {
            console.warn('Failed to build session digest for check-in:', error);
        });
        void retainCheckInToHindsight(updated).catch((error) => {
            console.warn('Hindsight retain failed (check-in):', error);
        });
    }

    return updated;
}

export async function deleteCheckIn(id: string): Promise<boolean> {
    const deleted = await withMutationLock(async () => {
        const map = await loadMap<IntentionCheckIn>(CHECKINS_KEY);
        if (!map[id]) return false;
        delete map[id];
        await saveMap(CHECKINS_KEY, map);
        return true;
    });
    if (!deleted) return false;

    try {
        await queueCheckInDelete(id);
    } catch (error) {
        console.warn('Failed to queue check-in delete:', error);
    }

    return true;
}

export async function clearAllIntentions(): Promise<void> {
    const ids = await withMutationLock(async () => {
        const map = await loadMap<Intention>(INTENTIONS_KEY);
        await AsyncStorage.removeItem(getAccountScopedStorageKey(INTENTIONS_KEY));
        return Object.keys(map);
    });
    await Promise.all(ids.map(async (id) => queueIntentionDelete(id)));
}

export async function clearAllCheckIns(): Promise<void> {
    const ids = await withMutationLock(async () => {
        const map = await loadMap<IntentionCheckIn>(CHECKINS_KEY);
        await AsyncStorage.removeItem(getAccountScopedStorageKey(CHECKINS_KEY));
        return Object.keys(map);
    });
    await Promise.all(ids.map(async (id) => queueCheckInDelete(id)));
}

export function migrateLegacyIntentionsToActiveAccount(): Promise<void> {
    return withMutationLock(async () => {
        await claimLegacyStorageKey(INTENTIONS_KEY);
        await claimLegacyStorageKey(CHECKINS_KEY);
    });
}

export async function hasLegacyIntentions(): Promise<boolean> {
    const [intentions, checkIns] = await Promise.all([
        AsyncStorage.getItem(INTENTIONS_KEY),
        AsyncStorage.getItem(CHECKINS_KEY),
    ]);
    return intentions !== null || checkIns !== null;
}

async function importSnapshot<T>(key: string, value: string | null): Promise<void> {
    if (value === null) {
        await AsyncStorage.removeItem(getAccountScopedStorageKey(key));
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
    await saveMap(key, items);
}

export function importIntentionsSnapshot(value: string | null): Promise<void> {
    return withMutationLock(() => importSnapshot<Intention>(INTENTIONS_KEY, value));
}

export function importCheckInsSnapshot(value: string | null): Promise<void> {
    return withMutationLock(() => importSnapshot<IntentionCheckIn>(CHECKINS_KEY, value));
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
