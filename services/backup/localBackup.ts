import AsyncStorage from '@react-native-async-storage/async-storage';

export const LOCAL_BACKUP_INDEX_KEY = '@blackrose_local_backups';

export const LOCAL_BACKUP_DATA_KEYS = [
    '@journal_entries',
    '@intentions',
    '@intention_checkins',
    '@goals',
    '@happiness_recipe_items',
    '@personas',
    '@persona_draft_settings',
    '@ai_response_feedback',
    '@rosebud_local_memory',
    '@saved_insights',
    '@weekly_insights_cache',
    '@blackrose_custom_ai_provider',
    'user-theme-preference',
    'user-emoji-preference',
    '@blackrose_color_theme',
] as const;

export type LocalBackupDataKey = typeof LOCAL_BACKUP_DATA_KEYS[number];

export interface LocalBackupManifest {
    readonly id: string;
    readonly name: string;
    readonly createdAt: number;
    readonly itemCount: number;
}

interface LocalBackupItem {
    readonly key: LocalBackupDataKey;
    readonly value: string | null;
}

interface StoredLocalBackup extends LocalBackupManifest {
    readonly schemaVersion: 1;
    readonly items: readonly LocalBackupItem[];
}

export type RestoreLocalBackupResult =
    | { readonly status: 'restored'; readonly restoredKeys: number }
    | { readonly status: 'missing' };

function generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isLocalBackupKey(value: unknown): value is LocalBackupDataKey {
    return typeof value === 'string' && LOCAL_BACKUP_DATA_KEYS.some((key) => key === value);
}

function isBackupItem(value: unknown): value is LocalBackupItem {
    return isObject(value)
        && isLocalBackupKey(value.key)
        && (typeof value.value === 'string' || value.value === null);
}

function isStoredBackup(value: unknown): value is StoredLocalBackup {
    return isObject(value)
        && value.schemaVersion === 1
        && typeof value.id === 'string'
        && typeof value.name === 'string'
        && typeof value.createdAt === 'number'
        && typeof value.itemCount === 'number'
        && Array.isArray(value.items)
        && value.items.every(isBackupItem);
}

function toManifest(backup: StoredLocalBackup): LocalBackupManifest {
    return {
        id: backup.id,
        name: backup.name,
        createdAt: backup.createdAt,
        itemCount: backup.itemCount,
    };
}

function parseStoredBackups(json: string): readonly StoredLocalBackup[] {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter(isStoredBackup) : [];
}

async function loadStoredBackups(): Promise<readonly StoredLocalBackup[]> {
    const json = await AsyncStorage.getItem(LOCAL_BACKUP_INDEX_KEY);
    if (!json) {
        return [];
    }

    try {
        return parseStoredBackups(json);
    } catch (error) {
        if (error instanceof SyntaxError) {
            return [];
        }
        throw error;
    }
}

async function saveStoredBackups(backups: readonly StoredLocalBackup[]): Promise<void> {
    await AsyncStorage.setItem(LOCAL_BACKUP_INDEX_KEY, JSON.stringify(backups));
}

async function readBackupItem(key: LocalBackupDataKey): Promise<LocalBackupItem> {
    return {
        key,
        value: await AsyncStorage.getItem(key),
    };
}

function resolveBackupName(name: string | undefined, createdAt: number): string {
    const trimmed = name?.trim();
    return trimmed && trimmed.length > 0
        ? trimmed
        : `Backup ${new Date(createdAt).toLocaleString()}`;
}

export async function listLocalBackups(): Promise<LocalBackupManifest[]> {
    const backups = await loadStoredBackups();
    return backups.map(toManifest);
}

export async function createLocalBackup(name?: string): Promise<LocalBackupManifest> {
    const createdAt = Date.now();
    const items = await Promise.all(LOCAL_BACKUP_DATA_KEYS.map(readBackupItem));
    const backup: StoredLocalBackup = {
        id: generateBackupId(),
        name: resolveBackupName(name, createdAt),
        createdAt,
        itemCount: items.filter((item) => item.value !== null).length,
        schemaVersion: 1,
        items,
    };

    const backups = await loadStoredBackups();
    await saveStoredBackups([backup, ...backups]);
    return toManifest(backup);
}

export async function restoreLocalBackup(
    backupId: string
): Promise<RestoreLocalBackupResult> {
    const backups = await loadStoredBackups();
    const backup = backups.find((item) => item.id === backupId);
    if (!backup) {
        return { status: 'missing' };
    }

    await Promise.all(LOCAL_BACKUP_DATA_KEYS.map(async (key) => {
        const item = backup.items.find((backupItem) => backupItem.key === key);
        if (!item || item.value === null) {
            await AsyncStorage.removeItem(key);
            return;
        }
        await AsyncStorage.setItem(key, item.value);
    }));

    return { status: 'restored', restoredKeys: backup.itemCount };
}

export async function deleteLocalBackup(backupId: string): Promise<boolean> {
    const backups = await loadStoredBackups();
    const nextBackups = backups.filter((backup) => backup.id !== backupId);
    if (nextBackups.length === backups.length) {
        return false;
    }

    await saveStoredBackups(nextBackups);
    return true;
}
