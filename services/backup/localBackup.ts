/**
 * On-device local backups.
 *
 * Session digests (Memory v3) are SHARDED at runtime and must stay sharded in
 * backups too. Never pack all embeddings into one AsyncStorage value under
 * `@rosebud_session_digests_bundle` or inside `@blackrose_local_backups` —
 * that reintroduces Android's ~2MB per-key ceiling.
 *
 * Backup shape for digests:
 *   - Lightweight meta in the backup record (ids only)
 *   - Bodies at `@blackrose_local_backup_session_digest:<backupId>:<sessionId>`
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    importSessionDigestsBundle,
    listSessionDigests,
    SESSION_DIGEST_BACKUP_BUNDLE_KEY,
    SESSION_DIGEST_SCHEMA_VERSION,
} from '@/services/memory/sessionDigestStorage';
import type { SessionDigest } from '@/services/memory/sessionDigest.types';
import { getAccountScopedStorageKey } from '@/services/account/accountScopedStorage';
import {
    registerAccountTeardown,
    requireActiveAccountId,
} from '@/services/account/accountRuntime';
import { importJournalEntriesSnapshot } from '@/services/journal/journalStorage';
import { importGoalsSnapshot } from '@/services/goals/goalsStorage';
import {
    importCheckInsSnapshot,
    importIntentionsSnapshot,
} from '@/services/intentions/intentionsStorage';

export const LOCAL_BACKUP_INDEX_KEY = '@blackrose_local_backups';

/** Per-digest bodies for a named backup — never one mega-blob. */
export const BACKUP_SESSION_DIGEST_KEY_PREFIX = '@blackrose_local_backup_session_digest:';

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
    '@rosebud_identity_profile',
    '@blackrose_day_digests',
    /**
     * Logical key only: value is lightweight meta (sessionIds + backupId).
     * Digest bodies live under BACKUP_SESSION_DIGEST_KEY_PREFIX — not this key.
     */
    SESSION_DIGEST_BACKUP_BUNDLE_KEY,
    '@saved_insights',
    '@weekly_insights_cache',
    '@blackrose_custom_ai_provider',
    'user-theme-preference',
    'user-emoji-preference',
    '@blackrose_color_theme',
] as const;

export type LocalBackupDataKey = typeof LOCAL_BACKUP_DATA_KEYS[number];

const ACCOUNT_SCOPED_BACKUP_KEYS = new Set<LocalBackupDataKey>([
    '@journal_entries',
    '@intentions',
    '@intention_checkins',
    '@goals',
    '@happiness_recipe_items',
    '@personas',
    '@persona_draft_settings',
    '@ai_response_feedback',
    '@rosebud_local_memory',
    '@rosebud_identity_profile',
    '@blackrose_day_digests',
    SESSION_DIGEST_BACKUP_BUNDLE_KEY,
    '@saved_insights',
    '@weekly_insights_cache',
    '@blackrose_custom_ai_provider',
]);

function resolveBackupStorageKey(key: LocalBackupDataKey): string {
    return ACCOUNT_SCOPED_BACKUP_KEYS.has(key)
        ? getAccountScopedStorageKey(key)
        : key;
}

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
    readonly schemaVersion: 2;
    readonly accountId: string;
    readonly items: readonly LocalBackupItem[];
}

/** Small meta only — ids, never embeddings. */
interface SessionDigestBackupMeta {
    readonly schemaVersion: number;
    readonly backupId: string;
    readonly sessionIds: readonly string[];
}

export type RestoreLocalBackupResult =
    | { readonly status: 'restored'; readonly restoredKeys: number }
    | { readonly status: 'account-mismatch' }
    | { readonly status: 'missing' };

let backupMutationQueue: Promise<void> = Promise.resolve();

function withBackupMutationLock<T>(operation: () => Promise<T>): Promise<T> {
    const result = backupMutationQueue.then(operation, operation);
    backupMutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

function generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function backupSessionDigestRecordKey(backupId: string, sessionId: string): string {
    return getAccountScopedStorageKey(
        `${BACKUP_SESSION_DIGEST_KEY_PREFIX}${backupId}:${sessionId}`
    );
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
        && value.schemaVersion === 2
        && typeof value.accountId === 'string'
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
    const json = await AsyncStorage.getItem(getAccountScopedStorageKey(LOCAL_BACKUP_INDEX_KEY));
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
    await AsyncStorage.setItem(
        getAccountScopedStorageKey(LOCAL_BACKUP_INDEX_KEY),
        JSON.stringify(backups)
    );
}

function parseDigestMeta(value: string | null | undefined): SessionDigestBackupMeta | null {
    if (!value) return null;
    try {
        const parsed = JSON.parse(value) as unknown;
        if (!isObject(parsed)) return null;
        if (typeof parsed.backupId !== 'string' || !parsed.backupId) return null;
        if (!Array.isArray(parsed.sessionIds)) return null;
        const sessionIds = parsed.sessionIds.filter(
            (id): id is string => typeof id === 'string' && id.length > 0,
        );
        return {
            schemaVersion: typeof parsed.schemaVersion === 'number'
                ? parsed.schemaVersion
                : SESSION_DIGEST_SCHEMA_VERSION,
            backupId: parsed.backupId,
            sessionIds,
        };
    } catch {
        return null;
    }
}

/**
 * Persist each digest under its own backup key. Returns lightweight meta JSON
 * for the backup record — never a packed embedding blob.
 */
async function writeShardedDigestBackup(backupId: string): Promise<string | null> {
    const digests = await listSessionDigests();
    if (digests.length === 0) return null;

    const sessionIds: string[] = [];
    for (const digest of digests) {
        sessionIds.push(digest.sessionId);
        await AsyncStorage.setItem(
            backupSessionDigestRecordKey(backupId, digest.sessionId),
            JSON.stringify(digest),
        );
    }

    const meta: SessionDigestBackupMeta = {
        schemaVersion: SESSION_DIGEST_SCHEMA_VERSION,
        backupId,
        sessionIds,
    };
    return JSON.stringify(meta);
}

async function removeShardedDigestBackup(backupId: string, sessionIds: readonly string[]): Promise<void> {
    await Promise.all(
        sessionIds.map((id) =>
            AsyncStorage.removeItem(backupSessionDigestRecordKey(backupId, id)),
        ),
    );
}

/**
 * Load sharded backup digests into an in-memory bundle string, then import
 * into runtime shards. The bundle string never becomes an AsyncStorage key.
 */
async function restoreShardedDigestBackup(metaJson: string | null): Promise<void> {
    const meta = parseDigestMeta(metaJson);
    if (!meta || meta.sessionIds.length === 0) {
        await importSessionDigestsBundle(null);
        return;
    }

    const digests: SessionDigest[] = [];
    for (const sessionId of meta.sessionIds) {
        const raw = await AsyncStorage.getItem(
            backupSessionDigestRecordKey(meta.backupId, sessionId),
        );
        if (!raw) continue;
        try {
            digests.push(JSON.parse(raw) as SessionDigest);
        } catch {
            // skip corrupt shard
        }
    }

    // In-memory only — importSessionDigestsBundle re-shards to runtime keys.
    const inMemoryBundle = JSON.stringify({
        schemaVersion: SESSION_DIGEST_SCHEMA_VERSION,
        digests,
    });
    await importSessionDigestsBundle(inMemoryBundle);
}

async function readBackupItem(
    key: LocalBackupDataKey,
    backupId: string,
): Promise<LocalBackupItem> {
    if (key === SESSION_DIGEST_BACKUP_BUNDLE_KEY) {
        return {
            key,
            // Meta only; bodies written under BACKUP_SESSION_DIGEST_KEY_PREFIX.
            value: await writeShardedDigestBackup(backupId),
        };
    }
    return {
        key,
        value: await AsyncStorage.getItem(resolveBackupStorageKey(key)),
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
    return withBackupMutationLock(async () => {
        const accountId = requireActiveAccountId();
        const createdAt = Date.now();
        const id = generateBackupId();
        const items = await Promise.all(
            LOCAL_BACKUP_DATA_KEYS.map((key) => readBackupItem(key, id)),
        );
        const backup: StoredLocalBackup = {
            id,
            accountId,
            name: resolveBackupName(name, createdAt),
            createdAt,
            itemCount: items.filter((item) => item.value !== null).length,
            schemaVersion: 2,
            items,
        };
        const backups = await loadStoredBackups();
        await saveStoredBackups([backup, ...backups]);
        return toManifest(backup);
    });
}

async function restoreBackupItem(item: LocalBackupItem | undefined): Promise<void> {
    const value = item?.value ?? null;
    switch (item?.key) {
        case '@journal_entries':
            return importJournalEntriesSnapshot(value);
        case '@goals':
            return importGoalsSnapshot(value);
        case '@intentions':
            return importIntentionsSnapshot(value);
        case '@intention_checkins':
            return importCheckInsSnapshot(value);
        default:
            return;
    }
}

export async function restoreLocalBackup(
    backupId: string
): Promise<RestoreLocalBackupResult> {
    return withBackupMutationLock(async () => {
        const accountId = requireActiveAccountId();
        const backups = await loadStoredBackups();
        const backup = backups.find((item) => item.id === backupId);
        if (!backup) return { status: 'missing' };
        if (backup.accountId !== accountId) return { status: 'account-mismatch' };

        await Promise.all(LOCAL_BACKUP_DATA_KEYS.map(async (key) => {
            const item = backup.items.find((backupItem) => backupItem.key === key);
            if (key === SESSION_DIGEST_BACKUP_BUNDLE_KEY) {
                await restoreShardedDigestBackup(item?.value ?? null);
                return;
            }
            if ([
                '@journal_entries', '@goals', '@intentions', '@intention_checkins',
            ].includes(key)) {
                await restoreBackupItem(item ?? { key, value: null });
                return;
            }
            const storageKey = resolveBackupStorageKey(key);
            if (!item || item.value === null) {
                await AsyncStorage.removeItem(storageKey);
                return;
            }
            await AsyncStorage.setItem(storageKey, item.value);
        }));

        if (requireActiveAccountId() !== accountId) {
            throw new Error('Active account changed during backup restore.');
        }
        return { status: 'restored', restoredKeys: backup.itemCount };
    });
}

export async function deleteLocalBackup(backupId: string): Promise<boolean> {
    return withBackupMutationLock(async () => {
        const accountId = requireActiveAccountId();
        const backups = await loadStoredBackups();
        const target = backups.find((backup) => backup.id === backupId);
        if (!target || target.accountId !== accountId) return false;
        const digestItem = target.items.find(
            (item) => item.key === SESSION_DIGEST_BACKUP_BUNDLE_KEY,
        );
        const meta = parseDigestMeta(digestItem?.value ?? null);
        if (meta) await removeShardedDigestBackup(meta.backupId, meta.sessionIds);
        await saveStoredBackups(backups.filter((backup) => backup.id !== backupId));
        return true;
    });
}

registerAccountTeardown(async () => {
    await backupMutationQueue;
});
