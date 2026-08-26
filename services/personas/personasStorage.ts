/**
 * Personas storage service
 */

import {
    AccountStorageAdapter,
    getStorageForAccount,
} from '@/services/account/accountScopedStorage';
import {
    AccountOperationContext,
    assertAccountOperationActive,
    registerAccountTeardown,
    runAccountBoundOperation,
} from '@/services/account/accountRuntime';
import { isRemoteDataSyncEnabled } from '@/services/data/dataProvider';
import { Persona, PersonaCreateInput, PersonaUpdateInput } from './personasStorage.types';
import {
    fetchRemotePersonas,
    mergePersonas,
    pushPersonas,
    queuePersonaDelete,
    queuePersonaUpsert,
} from './personasRemote';

const PERSONAS_KEY = '@personas';
export const DEFAULT_PERSONA_ID = 'persona_default_rosebud';
let hasPulledRemote = false;
let hasPushedLocal = false;
let syncPromise: Promise<void> | null = null;
let mutationQueue: Promise<void> = Promise.resolve();

registerAccountTeardown(() => {
    hasPulledRemote = false;
    hasPushedLocal = false;
    syncPromise = null;
    mutationQueue = Promise.resolve();
});

const DEFAULT_PERSONA = {
    id: DEFAULT_PERSONA_ID,
    name: 'Rosebud',
    tagline: 'Balanced and thoughtful',
    voice: 'Onyx',
    prompt: 'Respond as Rosebud, a balanced and thoughtful journaling companion.',
    model: 'nvidia/nemotron-3-ultra-550b-a55b',
    imagination: 25,
    avatarKey: 'persona-default',
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
} satisfies Persona;

function generateId(): string {
    return `persona_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

async function loadPersonasMap(storage: AccountStorageAdapter): Promise<Record<string, Persona>> {
    const json = await storage.getItem(PERSONAS_KEY);
    if (!json) return {};
    try {
        return JSON.parse(json) as Record<string, Persona>;
    } catch {
        return {};
    }
}

async function savePersonasMap(
    storage: AccountStorageAdapter,
    map: Record<string, Persona>,
): Promise<void> {
    await storage.setItem(PERSONAS_KEY, JSON.stringify(map));
}

function buildDefaultPersonasMap(): Record<string, Persona> {
    return {
        [DEFAULT_PERSONA_ID]: { ...DEFAULT_PERSONA },
    };
}

async function loadOrSeedPersonasMap(storage: AccountStorageAdapter): Promise<Record<string, Persona>> {
    const map = await loadPersonasMap(storage);
    if (Object.keys(map).length > 0) {
        return map;
    }

    const seeded = buildDefaultPersonasMap();
    await savePersonasMap(storage, seeded);
    return seeded;
}

async function syncFromRemoteIfNeeded(
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<void> {
    if (!isRemoteDataSyncEnabled()) {
        return;
    }

    if (syncPromise) {
        return syncPromise;
    }

    syncPromise = (async () => {
        const local = await loadPersonasMap(storage);
        assertAccountOperationActive(context);
        const hasLocal = Object.keys(local).length > 0;

        if (!hasLocal && !hasPulledRemote) {
            const remote = await fetchRemotePersonas();
            assertAccountOperationActive(context);
            if (remote) {
                hasPulledRemote = true;
                const merged = mergePersonas(local, remote);
                await savePersonasMap(storage, merged);
                assertAccountOperationActive(context);
            }
        }

        if (hasLocal && !hasPushedLocal) {
            try {
                const pushed = await pushPersonas(Object.values(local));
                assertAccountOperationActive(context);
                if (pushed) {
                    hasPushedLocal = true;
                }
            } catch (error) {
                if (context.signal.aborted) throw error;
                console.warn('Failed to push personas:', error);
            }
        }
    })();

    try {
        await syncPromise;
    } finally {
        syncPromise = null;
    }
}

export function listPersonas(): Promise<Persona[]> {
    return runAccountBoundOperation('personas-list', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        await syncFromRemoteIfNeeded(storage, context);
        assertAccountOperationActive(context);
        const map = await loadOrSeedPersonasMap(storage);
        assertAccountOperationActive(context);
        return Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
    });
}

export function getPersona(id: string): Promise<Persona | null> {
    return runAccountBoundOperation('personas-get', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        await syncFromRemoteIfNeeded(storage, context);
        assertAccountOperationActive(context);
        const map = await loadOrSeedPersonasMap(storage);
        assertAccountOperationActive(context);
        return map[id] ?? null;
    });
}

async function createPersonaForAccount(
    input: PersonaCreateInput,
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<Persona> {
    const now = Date.now();
    const personas = await loadOrSeedPersonasMap(storage);
    assertAccountOperationActive(context);
    const hasActive = Object.values(personas).some((p) => p.isActive);

    const persona: Persona = {
        id: generateId(),
        name: input.name.trim(),
        tagline: input.tagline.trim(),
        voice: input.voice,
        prompt: input.prompt.trim(),
        model: input.model,
        imagination: input.imagination,
        avatarKey: input.avatarKey,
        isActive: !hasActive,
        createdAt: now,
        updatedAt: now,
    };

    personas[persona.id] = persona;
    await savePersonasMap(storage, personas);
    assertAccountOperationActive(context);

    try {
        await queuePersonaUpsert(persona);
        assertAccountOperationActive(context);
    } catch (error) {
        if (context.signal.aborted) throw error;
        console.warn('Failed to queue persona sync:', error);
    }

    return persona;
}

export function createPersona(input: PersonaCreateInput): Promise<Persona> {
    return runAccountBoundOperation('personas-create', (context) => enqueueMutation(() => (
        createPersonaForAccount(input, getStorageForAccount(context.accountId), context)
    )));
}

async function updatePersonaForAccount(
    id: string,
    updates: PersonaUpdateInput,
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<Persona | null> {
    const map = await loadPersonasMap(storage);
    assertAccountOperationActive(context);
    const existing = map[id];
    if (!existing) {
        return null;
    }

    const updated: Persona = {
        ...existing,
        ...updates,
        name: updates.name ? updates.name.trim() : existing.name,
        tagline: updates.tagline ? updates.tagline.trim() : existing.tagline,
        prompt: updates.prompt ? updates.prompt.trim() : existing.prompt,
        updatedAt: Date.now(),
    };

    map[id] = updated;
    await savePersonasMap(storage, map);
    assertAccountOperationActive(context);

    if (updates.isActive) {
        await setActivePersona(id, storage, context, map);
        return map[id] ?? updated;
    }

    try {
        await queuePersonaUpsert(updated);
        assertAccountOperationActive(context);
    } catch (error) {
        if (context.signal.aborted) throw error;
        console.warn('Failed to queue persona sync:', error);
    }

    return updated;
}


export function updatePersona(
    id: string,
    updates: PersonaUpdateInput,
): Promise<Persona | null> {
    return runAccountBoundOperation('personas-update', (context) => enqueueMutation(() => (
        updatePersonaForAccount(id, updates, getStorageForAccount(context.accountId), context)
    )));
}

async function setActivePersona(
    id: string,
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
    map?: Record<string, Persona>,
): Promise<void> {
    const personas = map ?? (await loadOrSeedPersonasMap(storage));
    assertAccountOperationActive(context);

    Object.values(personas).forEach((persona) => {
        persona.isActive = persona.id === id;
        persona.updatedAt = Date.now();
    });

    await savePersonasMap(storage, personas);
    assertAccountOperationActive(context);

    await Promise.all(Object.values(personas).map(async (persona) => {
        try {
            await queuePersonaUpsert(persona);
        } catch (error) {
            if (context.signal.aborted) throw error;
            console.warn('Failed to queue persona sync:', error);
        }
    }));
    assertAccountOperationActive(context);
}

export function activatePersona(id: string): Promise<void> {
    return runAccountBoundOperation('personas-activate', (context) => enqueueMutation(() => (
        setActivePersona(id, getStorageForAccount(context.accountId), context)
    )));
}

async function deletePersonaForAccount(
    id: string,
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<boolean> {
    const map = await loadPersonasMap(storage);
    assertAccountOperationActive(context);
    if (!map[id]) {
        return false;
    }
    delete map[id];
    await savePersonasMap(storage, map);
    assertAccountOperationActive(context);

    try {
        await queuePersonaDelete(id);
        assertAccountOperationActive(context);
    } catch (error) {
        if (context.signal.aborted) throw error;
        console.warn('Failed to queue persona delete:', error);
    }

    return true;
}

export function deletePersona(id: string): Promise<boolean> {
    return runAccountBoundOperation('personas-delete', (context) => enqueueMutation(() => (
        deletePersonaForAccount(id, getStorageForAccount(context.accountId), context)
    )));
}

export async function getActivePersona(): Promise<Persona | null> {
    const list = await listPersonas();
    return list.find((p) => p.isActive) ?? null;
}

export function clearAllPersonas(): Promise<void> {
    return runAccountBoundOperation('personas-clear', (context) => enqueueMutation(async () => {
        const storage = getStorageForAccount(context.accountId);
        const map = await loadPersonasMap(storage);
        assertAccountOperationActive(context);
        await Promise.all(Object.keys(map).map(async (id) => queuePersonaDelete(id)));
        assertAccountOperationActive(context);
        await storage.removeItem(PERSONAS_KEY);
        assertAccountOperationActive(context);
    }));
}
