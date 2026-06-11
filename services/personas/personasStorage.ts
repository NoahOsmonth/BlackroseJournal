/**
 * Personas storage service
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
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

async function loadPersonasMap(): Promise<Record<string, Persona>> {
    const json = await AsyncStorage.getItem(PERSONAS_KEY);
    return json ? (JSON.parse(json) as Record<string, Persona>) : {};
}

async function savePersonasMap(map: Record<string, Persona>): Promise<void> {
    await AsyncStorage.setItem(PERSONAS_KEY, JSON.stringify(map));
}

function buildDefaultPersonasMap(): Record<string, Persona> {
    return {
        [DEFAULT_PERSONA_ID]: { ...DEFAULT_PERSONA },
    };
}

async function loadOrSeedPersonasMap(): Promise<Record<string, Persona>> {
    const map = await loadPersonasMap();
    if (Object.keys(map).length > 0) {
        return map;
    }

    const seeded = buildDefaultPersonasMap();
    await savePersonasMap(seeded);
    return seeded;
}

async function syncFromRemoteIfNeeded(): Promise<void> {
    if (!isRemoteDataSyncEnabled()) {
        return;
    }

    if (syncPromise) {
        return syncPromise;
    }

    syncPromise = (async () => {
        const local = await loadPersonasMap();
        const hasLocal = Object.keys(local).length > 0;

        if (!hasLocal && !hasPulledRemote) {
            const remote = await fetchRemotePersonas();
            if (remote) {
                hasPulledRemote = true;
                const merged = mergePersonas(local, remote);
                await savePersonasMap(merged);
            }
        }

        if (hasLocal && !hasPushedLocal) {
            try {
                const pushed = await pushPersonas(Object.values(local));
                if (pushed) {
                    hasPushedLocal = true;
                }
            } catch (error) {
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

export async function listPersonas(): Promise<Persona[]> {
    await syncFromRemoteIfNeeded();
    const map = await loadOrSeedPersonasMap();
    return Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getPersona(id: string): Promise<Persona | null> {
    await syncFromRemoteIfNeeded();
    const map = await loadOrSeedPersonasMap();
    return map[id] ?? null;
}

export async function createPersona(input: PersonaCreateInput): Promise<Persona> {
    const now = Date.now();
    const personas = await loadOrSeedPersonasMap();
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
    await savePersonasMap(personas);

    try {
        await queuePersonaUpsert(persona);
    } catch (error) {
        console.warn('Failed to queue persona sync:', error);
    }

    return persona;
}

export async function updatePersona(
    id: string,
    updates: PersonaUpdateInput
): Promise<Persona | null> {
    const map = await loadPersonasMap();
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
    await savePersonasMap(map);

    if (updates.isActive) {
        await setActivePersona(id, map);
        return map[id] ?? updated;
    }

    try {
        await queuePersonaUpsert(updated);
    } catch (error) {
        console.warn('Failed to queue persona sync:', error);
    }

    return updated;
}

async function setActivePersona(id: string, map?: Record<string, Persona>): Promise<void> {
    const personas = map ?? (await loadOrSeedPersonasMap());

    Object.values(personas).forEach((persona) => {
        persona.isActive = persona.id === id;
        persona.updatedAt = Date.now();
    });

    await savePersonasMap(personas);

    await Promise.all(Object.values(personas).map(async (persona) => {
        try {
            await queuePersonaUpsert(persona);
        } catch (error) {
            console.warn('Failed to queue persona sync:', error);
        }
    }));
}

export async function activatePersona(id: string): Promise<void> {
    await setActivePersona(id);
}

export async function deletePersona(id: string): Promise<boolean> {
    const map = await loadPersonasMap();
    if (!map[id]) {
        return false;
    }
    delete map[id];
    await savePersonasMap(map);

    try {
        await queuePersonaDelete(id);
    } catch (error) {
        console.warn('Failed to queue persona delete:', error);
    }

    return true;
}

export async function getActivePersona(): Promise<Persona | null> {
    const list = await listPersonas();
    return list.find((p) => p.isActive) ?? null;
}

export async function clearAllPersonas(): Promise<void> {
    const map = await loadPersonasMap();
    await Promise.all(Object.keys(map).map(async (id) => queuePersonaDelete(id)));
    await AsyncStorage.removeItem(PERSONAS_KEY);
}
