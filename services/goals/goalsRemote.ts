import { ensureSupabaseSession } from '@/services/supabase/supabaseClient';
import { enqueueSyncTask } from '@/services/supabase/syncQueue';
import { logSupabaseError } from '@/services/supabase/supabaseErrors';
import { GoalItem } from './goalsStorage.types';

const GOALS_TABLE = 'goals';

interface GoalRecord {
    id: string;
    title: string;
    type: string;
    date_key?: string | null;
    completed?: boolean | null;
    habit_completions?: string[] | null;
    intention_id?: string | null;
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

function buildGoalRecord(goal: GoalItem): GoalRecord {
    return {
        id: goal.id,
        title: goal.title,
        type: goal.type,
        date_key: goal.dateKey ?? null,
        completed: goal.completed ?? false,
        habit_completions: goal.habitCompletions ?? [],
        intention_id: goal.intentionId ?? null,
        created_at: new Date(goal.createdAt).toISOString(),
        updated_at: new Date(goal.updatedAt).toISOString(),
    };
}

export function mapRemoteGoal(record: GoalRecord): GoalItem {
    return {
        id: record.id,
        title: record.title ?? 'Goal',
        type: (record.type ?? 'goal') as GoalItem['type'],
        dateKey: record.date_key ?? undefined,
        completed: record.completed ?? false,
        habitCompletions: record.habit_completions ?? [],
        intentionId: record.intention_id ?? undefined,
        createdAt: parseTimestamp(record.created_at),
        updatedAt: parseTimestamp(record.updated_at),
    };
}

export async function queueGoalUpsert(goal: GoalItem): Promise<void> {
    await enqueueSyncTask({
        table: GOALS_TABLE,
        operation: 'upsert',
        payload: buildGoalRecord(goal),
        onConflict: 'id',
        dedupeKey: `${GOALS_TABLE}:${goal.id}`,
    });
}

export async function queueGoalDelete(id: string): Promise<void> {
    await enqueueSyncTask({
        table: GOALS_TABLE,
        operation: 'delete',
        primaryKey: 'id',
        primaryValue: id,
        dedupeKey: `${GOALS_TABLE}:${id}`,
    });
}

export async function fetchRemoteGoals(): Promise<GoalItem[] | null> {
    const client = await ensureSupabaseSession();
    if (!client) {
        return null;
    }

    const { data, error } = await client
        .from(GOALS_TABLE)
        .select('*')
        .order('updated_at', { ascending: false });

    if (error || !data) {
        if (error) {
            logSupabaseError('Failed to load remote goals', GOALS_TABLE, error.message);
        }
        return null;
    }

    return data
        .filter((row): row is GoalRecord => Boolean(row && row.id))
        .map(mapRemoteGoal);
}

export function mergeGoals(
    local: Record<string, GoalItem>,
    remote: GoalItem[]
): Record<string, GoalItem> {
    const merged = { ...local };
    remote.forEach((goal) => {
        const existing = merged[goal.id];
        if (!existing || goal.updatedAt >= existing.updatedAt) {
            merged[goal.id] = goal;
        }
    });
    return merged;
}

export async function pushGoals(goals: GoalItem[]): Promise<boolean> {
    if (goals.length === 0) {
        return true;
    }

    const client = await ensureSupabaseSession();
    if (!client) {
        return false;
    }

    const payload = goals.map(buildGoalRecord);
    const { error } = await client
        .from(GOALS_TABLE)
        .upsert(payload, { onConflict: 'id' });

    if (error) {
        logSupabaseError('Failed to push goals', GOALS_TABLE, error.message);
        return false;
    }

    return true;
}
