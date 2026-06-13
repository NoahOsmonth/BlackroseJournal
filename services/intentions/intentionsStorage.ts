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
import { saveIntentionCheckInMemories } from '../memory/localMemory';

const INTENTIONS_KEY = '@intentions';
const CHECKINS_KEY = '@intention_checkins';

let hasPulledIntentions = false;
let hasPushedIntentions = false;
let hasPulledCheckIns = false;
let hasPushedCheckIns = false;

let intentionsSyncPromise: Promise<void> | null = null;
let checkInsSyncPromise: Promise<void> | null = null;

function generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function loadMap<T>(key: string): Promise<Record<string, T>> {
    const json = await AsyncStorage.getItem(key);
    return json ? (JSON.parse(json) as Record<string, T>) : {};
}

async function saveMap<T>(key: string, data: Record<string, T>): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(data));
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
                const merged = mergeIntentions(local, remote);
                await saveMap(INTENTIONS_KEY, merged);
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
                const merged = mergeCheckIns(local, remote);
                await saveMap(CHECKINS_KEY, merged);
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

    const map = await loadMap<Intention>(INTENTIONS_KEY);
    map[intention.id] = intention;
    await saveMap(INTENTIONS_KEY, map);

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
    const map = await loadMap<Intention>(INTENTIONS_KEY);
    const existing = map[id];
    if (!existing) {
        return null;
    }

    const updated: Intention = {
        ...existing,
        ...updates,
        updatedAt: Date.now(),
    };

    map[id] = updated;
    await saveMap(INTENTIONS_KEY, map);

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
    const map = await loadMap<Intention>(INTENTIONS_KEY);
    if (!map[id]) {
        return false;
    }
    delete map[id];
    await saveMap(INTENTIONS_KEY, map);

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
        createdAt: now,
        updatedAt: now,
    };

    const map = await loadMap<IntentionCheckIn>(CHECKINS_KEY);
    map[checkIn.id] = checkIn;
    await saveMap(CHECKINS_KEY, map);

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
    }

    return checkIn;
}

export async function updateCheckIn(
    id: string,
    updates: IntentionCheckInUpdateInput
): Promise<IntentionCheckIn | null> {
    const map = await loadMap<IntentionCheckIn>(CHECKINS_KEY);
    const existing = map[id];
    if (!existing) {
        return null;
    }

    const updated: IntentionCheckIn = {
        ...existing,
        ...updates,
        title: updates.title ? updates.title.trim() : existing.title,
        summary: updates.summary ? updates.summary.trim() : existing.summary,
        updatedAt: Date.now(),
    };

    map[id] = updated;
    await saveMap(CHECKINS_KEY, map);

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
    }

    return updated;
}

export async function deleteCheckIn(id: string): Promise<boolean> {
    const map = await loadMap<IntentionCheckIn>(CHECKINS_KEY);
    if (!map[id]) {
        return false;
    }
    delete map[id];
    await saveMap(CHECKINS_KEY, map);

    try {
        await queueCheckInDelete(id);
    } catch (error) {
        console.warn('Failed to queue check-in delete:', error);
    }

    return true;
}

export async function clearAllIntentions(): Promise<void> {
    const map = await loadMap<Intention>(INTENTIONS_KEY);
    await Promise.all(Object.keys(map).map(async (id) => queueIntentionDelete(id)));
    await AsyncStorage.removeItem(INTENTIONS_KEY);
}

export async function clearAllCheckIns(): Promise<void> {
    const map = await loadMap<IntentionCheckIn>(CHECKINS_KEY);
    await Promise.all(Object.keys(map).map(async (id) => queueCheckInDelete(id)));
    await AsyncStorage.removeItem(CHECKINS_KEY);
}
