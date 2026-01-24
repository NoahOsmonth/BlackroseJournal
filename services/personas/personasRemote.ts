import { ensureSupabaseSession } from '@/services/supabase/supabaseClient';
import { enqueueSyncTask } from '@/services/supabase/syncQueue';
import { logSupabaseError } from '@/services/supabase/supabaseErrors';
import { Persona } from './personasStorage.types';

const PERSONAS_TABLE = 'personas';

interface PersonaRecord {
    id: string;
    name: string;
    tagline: string;
    voice: string;
    prompt: string;
    model: string;
    imagination: number;
    avatar_key?: string | null;
    is_active?: boolean | null;
    created_at: string;
    updated_at: string;
}

function parseTimestamp(value: unknown): number {
    if (typeof value === 'string' || typeof value === 'number') {
        const time = new Date(value).getTime();
        return Number.isNaN(time) ? Date.now() : time;
    }

    return Date.now();
}

function buildPersonaRecord(persona: Persona): PersonaRecord {
    return {
        id: persona.id,
        name: persona.name,
        tagline: persona.tagline,
        voice: persona.voice,
        prompt: persona.prompt,
        model: persona.model,
        imagination: persona.imagination,
        avatar_key: persona.avatarKey ?? null,
        is_active: persona.isActive ?? false,
        created_at: new Date(persona.createdAt).toISOString(),
        updated_at: new Date(persona.updatedAt).toISOString(),
    };
}

export function mapRemotePersona(record: PersonaRecord): Persona {
    return {
        id: record.id,
        name: record.name ?? 'Persona',
        tagline: record.tagline ?? '',
        voice: record.voice ?? 'Onyx',
        prompt: record.prompt ?? '',
        model: record.model ?? 'agent-default',
        imagination: typeof record.imagination === 'number' ? record.imagination : 25,
        avatarKey: record.avatar_key ?? undefined,
        isActive: record.is_active ?? false,
        createdAt: parseTimestamp(record.created_at),
        updatedAt: parseTimestamp(record.updated_at),
    };
}

export async function queuePersonaUpsert(persona: Persona): Promise<void> {
    await enqueueSyncTask({
        table: PERSONAS_TABLE,
        operation: 'upsert',
        payload: buildPersonaRecord(persona),
        onConflict: 'id',
        dedupeKey: `${PERSONAS_TABLE}:${persona.id}`,
    });
}

export async function queuePersonaDelete(id: string): Promise<void> {
    await enqueueSyncTask({
        table: PERSONAS_TABLE,
        operation: 'delete',
        primaryKey: 'id',
        primaryValue: id,
        dedupeKey: `${PERSONAS_TABLE}:${id}`,
    });
}

export async function fetchRemotePersonas(): Promise<Persona[] | null> {
    const client = await ensureSupabaseSession();
    if (!client) {
        return null;
    }

    const { data, error } = await client
        .from(PERSONAS_TABLE)
        .select('*')
        .order('updated_at', { ascending: false });

    if (error || !data) {
        if (error) {
            logSupabaseError('Failed to load remote personas', PERSONAS_TABLE, error.message);
        }
        return null;
    }

    return data
        .filter((row): row is PersonaRecord => Boolean(row && row.id))
        .map(mapRemotePersona);
}

export function mergePersonas(
    local: Record<string, Persona>,
    remote: Persona[]
): Record<string, Persona> {
    const merged = { ...local };
    remote.forEach((persona) => {
        const existing = merged[persona.id];
        if (!existing || persona.updatedAt >= existing.updatedAt) {
            merged[persona.id] = persona;
        }
    });
    return merged;
}

export async function pushPersonas(personas: Persona[]): Promise<boolean> {
    if (personas.length === 0) {
        return true;
    }

    const client = await ensureSupabaseSession();
    if (!client) {
        return false;
    }

    const payload = personas.map(buildPersonaRecord);
    const { error } = await client
        .from(PERSONAS_TABLE)
        .upsert(payload, { onConflict: 'id' });

    if (error) {
        logSupabaseError('Failed to push personas', PERSONAS_TABLE, error.message);
        return false;
    }

    return true;
}
