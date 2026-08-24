/* eslint-disable import/first */
/**
 * Backup must never land all session-digest embeddings under one AsyncStorage key.
 *
 * What would make this fail?
 * - Writing exportSessionDigestsBundle() into @rosebud_session_digests_bundle
 * - Embedding the full digests[] array into @blackrose_local_backups items value
 */

const mockStore = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null)),
        setItem: jest.fn((key: string, value: string) => {
            mockStore.set(key, value);
            return Promise.resolve();
        }),
        removeItem: jest.fn((key: string) => {
            mockStore.delete(key);
            return Promise.resolve();
        }),
        multiGet: jest.fn(async (keys: string[]) =>
            keys.map((k) => [k, mockStore.get(k) ?? null] as [string, string | null]),
        ),
        multiRemove: jest.fn(async (keys: string[]) => {
            keys.forEach((k) => mockStore.delete(k));
        }),
        getAllKeys: jest.fn(async () => Array.from(mockStore.keys())),
    },
}));

import {
    BACKUP_SESSION_DIGEST_KEY_PREFIX,
    backupSessionDigestRecordKey,
    createLocalBackup,
    LOCAL_BACKUP_INDEX_KEY,
    restoreLocalBackup,
} from '../../../services/backup/localBackup';
import {
    getSessionDigest,
    resetSessionDigestStorageAdapter,
    SESSION_DIGEST_BACKUP_BUNDLE_KEY,
    setSessionDigestStorageAdapter,
    upsertSessionDigest,
} from '../../../services/memory/sessionDigestStorage';
import type { SessionDigest } from '../../../services/memory/sessionDigest.types';
import { activateAccount, clearActiveAccount } from '../../../services/account/accountRuntime';
import { getAccountScopedStorageKey } from '../../../services/account/accountScopedStorage';

function adapterFromMockStore() {
    return {
        getItem: async (key: string) => mockStore.get(key) ?? null,
        setItem: async (key: string, value: string) => {
            mockStore.set(key, value);
        },
        removeItem: async (key: string) => {
            mockStore.delete(key);
        },
        multiGet: async (keys: readonly string[]) =>
            keys.map((k) => [k, mockStore.get(k) ?? null] as [string, string | null]),
        multiRemove: async (keys: readonly string[]) => {
            keys.forEach((k) => mockStore.delete(k));
        },
        getAllKeys: async () => Array.from(mockStore.keys()),
    };
}

function makeDigest(i: number): SessionDigest {
    const id = `sess_${String(i).padStart(4, '0')}`;
    return {
        schemaVersion: 1,
        sessionId: id,
        dateISO: `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
        oneLineSummary: `Session ${i} about work stress and family.`,
        topics: ['work stress', 'family'],
        entryWordCount: 40 + i,
        createdAt: 1_700_000_000_000 + i * 1000,
        sourceKind: 'journal_entry',
        sourceId: id,
    };
}

describe('session digest backup stays sharded', () => {
    beforeEach(async () => {
        mockStore.clear();
        setSessionDigestStorageAdapter(adapterFromMockStore());
        await activateAccount('backup-user');
    });

    afterEach(async () => {
        await clearActiveAccount();
        resetSessionDigestStorageAdapter();
        mockStore.clear();
    });

    /**
     * Past the old ~125 single-blob threshold with 2048-d vectors.
     * Export/createLocalBackup must succeed; no single key holds all embeddings.
     */
    it('backs up 150 digests without packing all embeddings into one key', async () => {
        const COUNT = 150;
        for (let i = 0; i < COUNT; i += 1) {
            await upsertSessionDigest(makeDigest(i));
        }

        const backup = await createLocalBackup('stress-150');
        expect(backup.id).toBeTruthy();

        // Logical bundle key must NOT exist as a runtime AsyncStorage entry of bodies.
        expect(mockStore.has(SESSION_DIGEST_BACKUP_BUNDLE_KEY)).toBe(false);

        // Sharded backup keys exist (one per digest).
        const backupDigestKeys = Array.from(mockStore.keys()).filter((k) =>
            k.startsWith(getAccountScopedStorageKey(BACKUP_SESSION_DIGEST_KEY_PREFIX)),
        );
        expect(backupDigestKeys.length).toBe(COUNT);

        // Index record must stay small: no embedding arrays inside LOCAL_BACKUP_INDEX_KEY.
        const indexJson = mockStore.get(getAccountScopedStorageKey(LOCAL_BACKUP_INDEX_KEY)) ?? '';
        expect(indexJson.includes('"embedding"')).toBe(false);
        expect(indexJson.length).toBeLessThan(500_000); // well under 2MB

        // Meta item lists sessionIds only.
        const parsed = JSON.parse(indexJson) as {
            items: { key: string; value: string | null }[];
        }[];
        const digestItem = parsed[0]?.items.find(
            (it) => it.key === SESSION_DIGEST_BACKUP_BUNDLE_KEY,
        );
        expect(digestItem?.value).toBeTruthy();
        const meta = JSON.parse(digestItem!.value!);
        expect(meta.sessionIds.length).toBe(COUNT);
        expect(meta.backupId).toBe(backup.id);
        expect(JSON.stringify(meta).includes('oneLineSummary')).toBe(false);

        // Spot-check a shard body exists.
        const sampleKey = backupSessionDigestRecordKey(backup.id, 'sess_0000');
        expect(mockStore.has(sampleKey)).toBe(true);

    });

    it('restore from sharded backup reloads a digest after clear', async () => {
        await upsertSessionDigest(makeDigest(7));
        const backup = await createLocalBackup('restore-one');

        // Wipe runtime digests.
        for (const key of Array.from(mockStore.keys())) {
            if (key.startsWith('@rosebud_session_digest')) {
                mockStore.delete(key);
            }
        }
        expect(await getSessionDigest('sess_0007')).toBeNull();

        const result = await restoreLocalBackup(backup.id);
        expect(result.status).toBe('restored');
        const loaded = await getSessionDigest('sess_0007');
        expect(loaded?.oneLineSummary).toContain('Session 7');
    });

    it('uses different shard body keys for different creator accounts', async () => {
        const userAKey = backupSessionDigestRecordKey('backup-1', 'session-1');
        await activateAccount('user-b');
        const userBKey = backupSessionDigestRecordKey('backup-1', 'session-1');

        expect(userAKey).not.toBe(userBKey);
    });
});
