import { ensureSupabaseSession, getSupabaseUserId } from '@/services/supabase/supabaseClient';
import { enqueueSyncTask } from '@/services/supabase/syncQueue';
import { logSupabaseError } from '@/services/supabase/supabaseErrors';

const SETTINGS_TABLE = 'user_settings';

type ThemePreference = 'light' | 'dark' | 'system';
type EmojiStylePreference = 'native' | 'flat' | '3d';

export interface RemoteUserSettings {
    theme?: ThemePreference;
    emojiStyle?: EmojiStylePreference;
}

interface UserSettingsRecord {
    owner_id: string;
    theme?: ThemePreference | null;
    emoji_style?: EmojiStylePreference | null;
    updated_at?: string | null;
}

export async function loadRemoteUserSettings(): Promise<RemoteUserSettings | null> {
    const client = await ensureSupabaseSession();
    if (!client) {
        return null;
    }

    const { data, error } = await client
        .from(SETTINGS_TABLE)
        .select('*')
        .limit(1);

    if (error) {
        logSupabaseError('Failed to load remote user settings', SETTINGS_TABLE, error.message);
        return null;
    }

    const record = Array.isArray(data) && data.length > 0 ? data[0] as UserSettingsRecord : null;
    if (!record) {
        return null;
    }

    return {
        theme: record.theme ?? undefined,
        emojiStyle: record.emoji_style ?? undefined,
    };
}

export async function saveRemoteUserSettings(settings: RemoteUserSettings): Promise<void> {
    const ownerId = await getSupabaseUserId();
    if (!ownerId) {
        return;
    }

    const payload: UserSettingsRecord = {
        owner_id: ownerId,
        theme: settings.theme ?? null,
        emoji_style: settings.emojiStyle ?? null,
        updated_at: new Date().toISOString(),
    };

    await enqueueSyncTask({
        table: SETTINGS_TABLE,
        operation: 'upsert',
        payload,
        onConflict: 'owner_id',
        dedupeKey: `${SETTINGS_TABLE}:${ownerId}`,
    });
}
