import { WeeklyInsightsResult } from '@/services/ai/ai';
import { getSupabaseUserId, ensureSupabaseSession } from '@/services/supabase/supabaseClient';
import { enqueueSyncTask } from '@/services/supabase/syncQueue';

const INSIGHTS_TABLE = 'weekly_insights';

export interface RemoteWeeklyInsights {
    weekKey: string;
    insights: WeeklyInsightsResult;
    entryCount: number;
    cachedAt: number;
}

interface WeeklyInsightsRecord {
    owner_id: string;
    week_key: string;
    insights: WeeklyInsightsResult;
    entry_count: number;
    cached_at: string;
}

function parseTimestamp(value: unknown): number {
    if (typeof value === 'string' || typeof value === 'number') {
        const time = new Date(value).getTime();
        return Number.isNaN(time) ? Date.now() : time;
    }

    return Date.now();
}

export async function loadRemoteWeeklyInsights(weekKey: string): Promise<RemoteWeeklyInsights | null> {
    const client = await ensureSupabaseSession();
    if (!client) {
        return null;
    }

    const { data, error } = await client
        .from(INSIGHTS_TABLE)
        .select('*')
        .eq('week_key', weekKey)
        .order('cached_at', { ascending: false })
        .limit(1);

    if (error) {
        console.warn('Failed to load remote weekly insights:', error.message);
        return null;
    }

    const record = Array.isArray(data) && data.length > 0 ? data[0] as WeeklyInsightsRecord : null;
    if (!record) {
        return null;
    }

    return {
        weekKey: record.week_key,
        insights: record.insights,
        entryCount: record.entry_count,
        cachedAt: parseTimestamp(record.cached_at),
    };
}

export async function saveRemoteWeeklyInsights(
    weekKey: string,
    insights: WeeklyInsightsResult,
    entryCount: number
): Promise<void> {
    const ownerId = await getSupabaseUserId();
    if (!ownerId) {
        return;
    }

    const payload = {
        owner_id: ownerId,
        week_key: weekKey,
        insights,
        entry_count: entryCount,
        cached_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    await enqueueSyncTask({
        table: INSIGHTS_TABLE,
        operation: 'upsert',
        payload,
        onConflict: 'owner_id,week_key',
        dedupeKey: `${INSIGHTS_TABLE}:${ownerId}:${weekKey}`,
    });
}

export async function deleteRemoteWeeklyInsights(weekKey: string): Promise<void> {
    const ownerId = await getSupabaseUserId();
    if (!ownerId) {
        return;
    }

    await enqueueSyncTask({
        table: INSIGHTS_TABLE,
        operation: 'delete',
        primaryKey: 'week_key',
        primaryValue: weekKey,
        dedupeKey: `${INSIGHTS_TABLE}:${ownerId}:${weekKey}`,
    });
}
