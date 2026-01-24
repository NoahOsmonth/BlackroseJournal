import { ensureSupabaseSession } from '@/services/supabase/supabaseClient';
import { enqueueSyncTask } from '@/services/supabase/syncQueue';
import { logSupabaseError } from '@/services/supabase/supabaseErrors';
import {
    Intention,
    IntentionCheckIn,
} from './intentionsStorage.types';

const INTENTIONS_TABLE = 'intentions';
const CHECKINS_TABLE = 'intention_checkins';

interface IntentionRecord {
    id: string;
    title: string;
    description: string;
    area: string;
    icon_key?: string | null;
    image_key?: string | null;
    is_archived?: boolean | null;
    created_at: string;
    updated_at: string;
}

interface IntentionCheckInRecord {
    id: string;
    intention_id?: string | null;
    type: string;
    title: string;
    summary: string;
    mood?: string | null;
    persona_id?: string | null;
    messages?: unknown;
    status: string;
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

function coerceArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
}

function buildIntentionRecord(intention: Intention): IntentionRecord {
    return {
        id: intention.id,
        title: intention.title,
        description: intention.description,
        area: intention.area,
        icon_key: intention.iconKey ?? null,
        image_key: intention.imageKey ?? null,
        is_archived: intention.isArchived ?? false,
        created_at: new Date(intention.createdAt).toISOString(),
        updated_at: new Date(intention.updatedAt).toISOString(),
    };
}

function buildCheckInRecord(checkIn: IntentionCheckIn): IntentionCheckInRecord {
    return {
        id: checkIn.id,
        intention_id: checkIn.intentionId ?? null,
        type: checkIn.type,
        title: checkIn.title,
        summary: checkIn.summary,
        mood: checkIn.mood ?? null,
        persona_id: checkIn.personaId ?? null,
        messages: checkIn.messages ?? [],
        status: checkIn.status,
        created_at: new Date(checkIn.createdAt).toISOString(),
        updated_at: new Date(checkIn.updatedAt).toISOString(),
    };
}

export function mapRemoteIntention(record: IntentionRecord): Intention {
    return {
        id: record.id,
        title: record.title ?? 'Untitled',
        description: record.description ?? '',
        area: (record.area ?? 'wellbeing') as Intention['area'],
        iconKey: record.icon_key ?? undefined,
        imageKey: record.image_key ?? undefined,
        isArchived: record.is_archived ?? false,
        createdAt: parseTimestamp(record.created_at),
        updatedAt: parseTimestamp(record.updated_at),
    };
}

export function mapRemoteCheckIn(record: IntentionCheckInRecord): IntentionCheckIn {
    return {
        id: record.id,
        intentionId: record.intention_id ?? undefined,
        type: (record.type ?? 'intention') as IntentionCheckIn['type'],
        title: record.title ?? 'Check-in',
        summary: record.summary ?? '',
        mood: record.mood ?? undefined,
        personaId: record.persona_id ?? undefined,
        messages: coerceArray(record.messages),
        status: (record.status ?? 'completed') as IntentionCheckIn['status'],
        createdAt: parseTimestamp(record.created_at),
        updatedAt: parseTimestamp(record.updated_at),
    };
}

export async function queueIntentionUpsert(intention: Intention): Promise<void> {
    await enqueueSyncTask({
        table: INTENTIONS_TABLE,
        operation: 'upsert',
        payload: buildIntentionRecord(intention),
        onConflict: 'id',
        dedupeKey: `${INTENTIONS_TABLE}:${intention.id}`,
    });
}

export async function queueIntentionDelete(id: string): Promise<void> {
    await enqueueSyncTask({
        table: INTENTIONS_TABLE,
        operation: 'delete',
        primaryKey: 'id',
        primaryValue: id,
        dedupeKey: `${INTENTIONS_TABLE}:${id}`,
    });
}

export async function queueCheckInUpsert(checkIn: IntentionCheckIn): Promise<void> {
    await enqueueSyncTask({
        table: CHECKINS_TABLE,
        operation: 'upsert',
        payload: buildCheckInRecord(checkIn),
        onConflict: 'id',
        dedupeKey: `${CHECKINS_TABLE}:${checkIn.id}`,
    });
}

export async function queueCheckInDelete(id: string): Promise<void> {
    await enqueueSyncTask({
        table: CHECKINS_TABLE,
        operation: 'delete',
        primaryKey: 'id',
        primaryValue: id,
        dedupeKey: `${CHECKINS_TABLE}:${id}`,
    });
}

export async function fetchRemoteIntentions(): Promise<Intention[] | null> {
    const client = await ensureSupabaseSession();
    if (!client) {
        return null;
    }

    const { data, error } = await client
        .from(INTENTIONS_TABLE)
        .select('*')
        .order('updated_at', { ascending: false });

    if (error || !data) {
        if (error) {
            logSupabaseError('Failed to load remote intentions', INTENTIONS_TABLE, error.message);
        }
        return null;
    }

    return data
        .filter((row): row is IntentionRecord => Boolean(row && row.id))
        .map(mapRemoteIntention);
}

export async function fetchRemoteCheckIns(): Promise<IntentionCheckIn[] | null> {
    const client = await ensureSupabaseSession();
    if (!client) {
        return null;
    }

    const { data, error } = await client
        .from(CHECKINS_TABLE)
        .select('*')
        .order('updated_at', { ascending: false });

    if (error || !data) {
        if (error) {
            logSupabaseError('Failed to load remote check-ins', CHECKINS_TABLE, error.message);
        }
        return null;
    }

    return data
        .filter((row): row is IntentionCheckInRecord => Boolean(row && row.id))
        .map(mapRemoteCheckIn);
}

export function mergeIntentions(
    local: Record<string, Intention>,
    remote: Intention[]
): Record<string, Intention> {
    const merged = { ...local };
    remote.forEach((item) => {
        const existing = merged[item.id];
        if (!existing || item.updatedAt >= existing.updatedAt) {
            merged[item.id] = item;
        }
    });
    return merged;
}

export function mergeCheckIns(
    local: Record<string, IntentionCheckIn>,
    remote: IntentionCheckIn[]
): Record<string, IntentionCheckIn> {
    const merged = { ...local };
    remote.forEach((item) => {
        const existing = merged[item.id];
        if (!existing || item.updatedAt >= existing.updatedAt) {
            merged[item.id] = item;
        }
    });
    return merged;
}

export async function pushIntentions(intentions: Intention[]): Promise<boolean> {
    if (intentions.length === 0) {
        return true;
    }

    const client = await ensureSupabaseSession();
    if (!client) {
        return false;
    }

    const payload = intentions.map(buildIntentionRecord);
    const { error } = await client
        .from(INTENTIONS_TABLE)
        .upsert(payload, { onConflict: 'id' });

    if (error) {
        logSupabaseError('Failed to push intentions', INTENTIONS_TABLE, error.message);
        return false;
    }

    return true;
}

export async function pushCheckIns(checkIns: IntentionCheckIn[]): Promise<boolean> {
    if (checkIns.length === 0) {
        return true;
    }

    const client = await ensureSupabaseSession();
    if (!client) {
        return false;
    }

    const payload = checkIns.map(buildCheckInRecord);
    const { error } = await client
        .from(CHECKINS_TABLE)
        .upsert(payload, { onConflict: 'id' });

    if (error) {
        logSupabaseError('Failed to push check-ins', CHECKINS_TABLE, error.message);
        return false;
    }

    return true;
}
