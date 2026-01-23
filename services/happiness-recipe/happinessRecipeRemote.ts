import { ensureSupabaseSession } from '@/services/supabase/supabaseClient';
import { enqueueSyncTask } from '@/services/supabase/syncQueue';
import { RecipeItem } from './happinessRecipeStorage.types';

const RECIPE_TABLE = 'happiness_recipe_items';

interface RecipeItemRecord {
    id: string;
    type: string;
    text: string;
    completed: boolean;
    completed_at?: string | null;
    created_at: string;
    updated_at: string;
}

function parseTimestamp(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'number') {
        return new Date(value).toISOString();
    }

    return new Date().toISOString();
}

function mapRemoteItem(record: RecipeItemRecord): RecipeItem {
    return {
        id: record.id,
        type: record.type as RecipeItem['type'],
        text: record.text,
        completed: record.completed,
        completedAt: record.completed_at ?? undefined,
        createdAt: parseTimestamp(record.created_at),
        updatedAt: parseTimestamp(record.updated_at),
    };
}

export async function loadRemoteRecipeItems(): Promise<RecipeItem[] | null> {
    const client = await ensureSupabaseSession();
    if (!client) {
        return null;
    }

    const { data, error } = await client
        .from(RECIPE_TABLE)
        .select('*')
        .order('updated_at', { ascending: false });

    if (error || !data) {
        if (error) {
            console.warn('Failed to load remote recipe items:', error.message);
        }
        return null;
    }

    return data
        .filter((row): row is RecipeItemRecord => Boolean(row && row.id))
        .map(mapRemoteItem);
}

export async function queueRecipeItemUpsert(item: RecipeItem): Promise<void> {
    const payload: RecipeItemRecord = {
        id: item.id,
        type: item.type,
        text: item.text,
        completed: item.completed,
        completed_at: item.completedAt ?? null,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
    };

    await enqueueSyncTask({
        table: RECIPE_TABLE,
        operation: 'upsert',
        payload,
        onConflict: 'id',
        dedupeKey: `${RECIPE_TABLE}:${item.id}`,
    });
}

export async function queueRecipeItemDelete(id: string): Promise<void> {
    await enqueueSyncTask({
        table: RECIPE_TABLE,
        operation: 'delete',
        primaryKey: 'id',
        primaryValue: id,
        dedupeKey: `${RECIPE_TABLE}:${id}`,
    });
}
