import { ensureSupabaseSession } from '@/services/supabase/supabaseClient';
import { enqueueSyncTask } from '@/services/supabase/syncQueue';
import { logSupabaseError } from '@/services/supabase/supabaseErrors';
import { SavedInsight } from './savedInsightsStorage.types';

const INSIGHTS_TABLE = 'saved_insights';

interface SavedInsightRecord {
    id: string;
    question: string;
    source_date?: string | null;
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

function buildInsightRecord(insight: SavedInsight): SavedInsightRecord {
    return {
        id: insight.id,
        question: insight.question,
        source_date: insight.sourceDate ?? null,
        created_at: new Date(insight.createdAt).toISOString(),
        updated_at: new Date(insight.updatedAt).toISOString(),
    };
}

export function mapRemoteInsight(record: SavedInsightRecord): SavedInsight {
    return {
        id: record.id,
        question: record.question ?? '',
        sourceDate: record.source_date ?? undefined,
        createdAt: parseTimestamp(record.created_at),
        updatedAt: parseTimestamp(record.updated_at),
    };
}

export async function queueSavedInsightUpsert(insight: SavedInsight): Promise<void> {
    await enqueueSyncTask({
        table: INSIGHTS_TABLE,
        operation: 'upsert',
        payload: buildInsightRecord(insight),
        onConflict: 'id',
        dedupeKey: `${INSIGHTS_TABLE}:${insight.id}`,
    });
}

export async function queueSavedInsightDelete(id: string): Promise<void> {
    await enqueueSyncTask({
        table: INSIGHTS_TABLE,
        operation: 'delete',
        primaryKey: 'id',
        primaryValue: id,
        dedupeKey: `${INSIGHTS_TABLE}:${id}`,
    });
}

export async function fetchRemoteSavedInsights(): Promise<SavedInsight[] | null> {
    const client = await ensureSupabaseSession();
    if (!client) {
        return null;
    }

    const { data, error } = await client
        .from(INSIGHTS_TABLE)
        .select('*')
        .order('updated_at', { ascending: false });

    if (error || !data) {
        if (error) {
            logSupabaseError('Failed to load remote saved insights', INSIGHTS_TABLE, error.message);
        }
        return null;
    }

    return data
        .filter((row): row is SavedInsightRecord => Boolean(row && row.id))
        .map(mapRemoteInsight);
}

export function mergeSavedInsights(
    local: Record<string, SavedInsight>,
    remote: SavedInsight[]
): Record<string, SavedInsight> {
    const merged = { ...local };
    remote.forEach((insight) => {
        const existing = merged[insight.id];
        if (!existing || insight.updatedAt >= existing.updatedAt) {
            merged[insight.id] = insight;
        }
    });
    return merged;
}

export async function pushSavedInsights(insights: SavedInsight[]): Promise<boolean> {
    if (insights.length === 0) {
        return true;
    }

    const client = await ensureSupabaseSession();
    if (!client) {
        return false;
    }

    const payload = insights.map(buildInsightRecord);
    const { error } = await client
        .from(INSIGHTS_TABLE)
        .upsert(payload, { onConflict: 'id' });

    if (error) {
        logSupabaseError('Failed to push saved insights', INSIGHTS_TABLE, error.message);
        return false;
    }

    return true;
}
