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
import {
    getAccountScopedStorageKey,
    getAccountScopedStorageKeyForAccount,
} from '@/services/account/accountScopedStorage';
import {
    AccountOperationContext,
    assertAccountOperationActive,
    registerAccountTeardown,
    runAccountBoundOperation,
} from '@/services/account/accountRuntime';
import {
    importJournalEntriesForAccount,
    importJournalEntriesSnapshot,
} from '@/services/journal/journalStorage';
import {
    importGoalsForAccount,
    importGoalsSnapshot,
} from '@/services/goals/goalsStorage';
import {
    importCheckInsSnapshot,
    importIntentionsSnapshot,
    importSnapshotForAccount,
} from '@/services/intentions/intentionsStorage';
import type { Intention, IntentionCheckIn } from '@/services/intentions/intentionsStorage.types';

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

function resolveBackupStorageKey(key: LocalBackupDataKey, accountId: string): string {
    return ACCOUNT_SCOPED_BACKUP_KEYS.has(key)
        ? getAccountScopedStorageKeyForAccount(key, accountId)
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

function requireAccountId(context: AccountOperationContext): string {
    if (!context.accountId) {
        throw new Error('Account-scoped backup is unavailable before auth bootstrap completes.');
    }
    return context.accountId;
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

async function loadStoredBackups(
    accountId: string,
    context: AccountOperationContext,
): Promise<readonly StoredLocalBackup[]> {
    assertAccountOperationActive(context);
    const json = await AsyncStorage.getItem(
        getAccountScopedStorageKeyForAccount(LOCAL_BACKUP_INDEX_KEY, accountId),
    );
    assertAccountOperationActive(context);
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

async function saveStoredBackups(
    backups: readonly StoredLocalBackup[],
    accountId: string,
    context: AccountOperationContext,
): Promise<void> {
    assertAccountOperationActive(context);
    await AsyncStorage.setItem(
        getAccountScopedStorageKeyForAccount(LOCAL_BACKUP_INDEX_KEY, accountId),
        JSON.stringify(backups),
    );
    assertAccountOperationActive(context);
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
async function writeShardedDigestBackup(
    backupId: string,
    accountId: string,
    context: AccountOperationContext,
): Promise<string | null> {
    assertAccountOperationActive(context);
    const digests = await listSessionDigests();
    assertAccountOperationActive(context);
    if (digests.length === 0) return null;

    const sessionIds: string[] = [];
    for (const digest of digests) {
        assertAccountOperationActive(context);
        sessionIds.push(digest.sessionId);
        await AsyncStorage.setItem(
            getAccountScopedStorageKeyForAccount(
                `${BACKUP_SESSION_DIGEST_KEY_PREFIX}${backupId}:${digest.sessionId}`,
                accountId,
            ),
            JSON.stringify(digest),
        );
        assertAccountOperationActive(context);
    }

    const meta: SessionDigestBackupMeta = {
        schemaVersion: SESSION_DIGEST_SCHEMA_VERSION,
        backupId,
        sessionIds,
    };
    return JSON.stringify(meta);
}

async function removeShardedDigestBackup(
    backupId: string,
    sessionIds: readonly string[],
    accountId: string,
    context: AccountOperationContext,
): Promise<void> {
    for (const sessionId of sessionIds) {
        assertAccountOperationActive(context);
        await AsyncStorage.removeItem(getAccountScopedStorageKeyForAccount(
            `${BACKUP_SESSION_DIGEST_KEY_PREFIX}${backupId}:${sessionId}`,
            accountId,
        ));
        assertAccountOperationActive(context);
    }
}

/**
 * Load sharded backup digests into an in-memory bundle string, then import
 * into runtime shards. The bundle string never becomes an AsyncStorage key.
 */
async function restoreShardedDigestBackup(
    metaJson: string | null,
    accountId: string,
    context: AccountOperationContext,
): Promise<void> {
    const meta = parseDigestMeta(metaJson);
    if (!meta || meta.sessionIds.length === 0) {
        assertAccountOperationActive(context);
        await importSessionDigestsBundle(null);
        assertAccountOperationActive(context);
        return;
    }

    const digests: SessionDigest[] = [];
    for (const sessionId of meta.sessionIds) {
        assertAccountOperationActive(context);
        const raw = await AsyncStorage.getItem(getAccountScopedStorageKeyForAccount(
            `${BACKUP_SESSION_DIGEST_KEY_PREFIX}${meta.backupId}:${sessionId}`,
            accountId,
        ));
        assertAccountOperationActive(context);
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
    assertAccountOperationActive(context);
    await importSessionDigestsBundle(inMemoryBundle);
    assertAccountOperationActive(context);
}

async function readBackupItem(
    key: LocalBackupDataKey,
    backupId: string,
    accountId: string,
    context: AccountOperationContext,
): Promise<LocalBackupItem> {
    assertAccountOperationActive(context);
    if (key === SESSION_DIGEST_BACKUP_BUNDLE_KEY) {
        const value = await writeShardedDigestBackup(backupId, accountId, context);
        assertAccountOperationActive(context);
        return { key, value };
    }

    const value = await AsyncStorage.getItem(resolveBackupStorageKey(key, accountId));
    assertAccountOperationActive(context);
    return { key, value };
}

function resolveBackupName(name: string | undefined, createdAt: number): string {
    const trimmed = name?.trim();
    return trimmed && trimmed.length > 0
        ? trimmed
        : `Backup ${new Date(createdAt).toLocaleString()}`;
}

export function listLocalBackups(): Promise<LocalBackupManifest[]> {
    return runAccountBoundOperation('local-backup-list', (context) => (
        withBackupMutationLock(async () => {
            const accountId = requireAccountId(context);
            const backups = await loadStoredBackups(accountId, context);
            assertAccountOperationActive(context);
            return backups.map(toManifest);
        })
    ));
}

export function createLocalBackup(name?: string): Promise<LocalBackupManifest> {
    return runAccountBoundOperation('local-backup-create', (context) => (
        withBackupMutationLock(async () => {
            const accountId = requireAccountId(context);
            const createdAt = Date.now();
            const id = generateBackupId();
            const items: LocalBackupItem[] = [];
            for (const key of LOCAL_BACKUP_DATA_KEYS) {
                items.push(await readBackupItem(key, id, accountId, context));
                assertAccountOperationActive(context);
            }
            const backup: StoredLocalBackup = {
                id,
                accountId,
                name: resolveBackupName(name, createdAt),
                createdAt,
                itemCount: items.filter((item) => item.value !== null).length,
                schemaVersion: 2,
                items,
            };
            const backups = await loadStoredBackups(accountId, context);
            assertAccountOperationActive(context);
            await saveStoredBackups([backup, ...backups], accountId, context);
            return toManifest(backup);
        })
    ));
}

async function restoreBackupItem(
    item: LocalBackupItem | undefined,
    context: AccountOperationContext,
): Promise<void> {
    assertAccountOperationActive(context);
    const value = item?.value ?? null;
    switch (item?.key) {
        case '@journal_entries':
            await importJournalEntriesSnapshot(
                value,
                async (ownerContext) => {
                    assertAccountOperationActive(context);
                    await importJournalEntriesForAccount(ownerContext, value);
                },
            );
            break;
        case '@goals':
            await importGoalsSnapshot(
                value,
                async (ownerContext) => {
                    assertAccountOperationActive(context);
                    await importGoalsForAccount(ownerContext, value);
                },
            );
            break;
        case '@intentions':
            await importIntentionsSnapshot(
                value,
                async (ownerContext) => {
                    assertAccountOperationActive(context);
                    await importSnapshotForAccount<Intention>(ownerContext, '@intentions', value);
                },
            );
            break;
        case '@intention_checkins':
            await importCheckInsSnapshot(
                value,
                async (ownerContext) => {
                    assertAccountOperationActive(context);
                    await importSnapshotForAccount<IntentionCheckIn>(
                        ownerContext,
                        '@intention_checkins',
                        value,
                    );
                },
            );
            break;
        default:
            break;
    }
    assertAccountOperationActive(context);
}

export function restoreLocalBackup(
    backupId: string,
): Promise<RestoreLocalBackupResult> {
    return runAccountBoundOperation('local-backup-restore', (context) => (
        withBackupMutationLock(async () => {
            const accountId = requireAccountId(context);
            const backups = await loadStoredBackups(accountId, context);
            const backup = backups.find((item) => item.id === backupId);
            if (!backup) return { status: 'missing' };
            if (backup.accountId !== accountId) return { status: 'account-mismatch' };

            for (const key of LOCAL_BACKUP_DATA_KEYS) {
                assertAccountOperationActive(context);
                const item = backup.items.find((backupItem) => backupItem.key === key);
                if (key === SESSION_DIGEST_BACKUP_BUNDLE_KEY) {
                    await restoreShardedDigestBackup(item?.value ?? null, accountId, context);
                    continue;
                }
                if (
                    key === '@journal_entries'
                    || key === '@goals'
                    || key === '@intentions'
                    || key === '@intention_checkins'
                ) {
                    await restoreBackupItem(item ?? { key, value: null }, context);
                    continue;
                }

                const storageKey = resolveBackupStorageKey(key, accountId);
                assertAccountOperationActive(context);
                if (!item || item.value === null) {
                    await AsyncStorage.removeItem(storageKey);
                } else {
                    await AsyncStorage.setItem(storageKey, item.value);
                }
                assertAccountOperationActive(context);
            }

            assertAccountOperationActive(context);
            return { status: 'restored', restoredKeys: backup.itemCount };
        })
    ));
}

export function deleteLocalBackup(backupId: string): Promise<boolean> {
    return runAccountBoundOperation('local-backup-delete', (context) => (
        withBackupMutationLock(async () => {
            const accountId = requireAccountId(context);
            const backups = await loadStoredBackups(accountId, context);
            const target = backups.find((backup) => backup.id === backupId);
            if (!target || target.accountId !== accountId) return false;
            const digestItem = target.items.find(
                (item) => item.key === SESSION_DIGEST_BACKUP_BUNDLE_KEY,
            );
            const meta = parseDigestMeta(digestItem?.value ?? null);
            if (meta) {
                await removeShardedDigestBackup(meta.backupId, meta.sessionIds, accountId, context);
            }
            assertAccountOperationActive(context);
            await saveStoredBackups(
                backups.filter((backup) => backup.id !== backupId),
                accountId,
                context,
            );
            return true;
        })
    ));
}

registerAccountTeardown(async () => {
    await backupMutationQueue;
});
