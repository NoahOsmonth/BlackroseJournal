/* eslint-disable import/first */

/**
 * Rule 4 ownership: `services/backup/localBackup.ts` must not write the offline
 * memory-file keys (`@blackrose_memory_manifest`, `@blackrose_memory_file:<id>`)
 * itself. Those keys belong to `services/memory/memoryFiles.ts`, and every
 * mutation of them must be funneled through that module's serialized
 * `withFilesLock`. Writing them raw let a restore interleave with a staging
 * operation's read-modify-write and silently drop one side.
 *
 * The same file already routes the atom store through its owner
 * (`importMemoryBundle` / `exportMemoryBundle`) — these tests pin the
 * memory-file path to the same standard.
 *
 * The recording adapter below is the memory module's storage seam. A write that
 * goes through the owning module is observed there; a raw `AsyncStorage` write
 * from localBackup is not.
 */

const mockStore = new Map<string, string>();
let mockDelayedGet: {
    key: string;
    started: () => void;
    release: Promise<void>;
} | null = null;

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(async (key: string) => {
            if (mockDelayedGet?.key === key) {
                const pending = mockDelayedGet;
                mockDelayedGet = null;
                pending.started();
                await pending.release;
            }
            return mockStore.get(key) ?? null;
        }),
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

import { createLocalBackup, restoreLocalBackup } from '../services/backup/localBackup';
import {
    resetSessionDigestStorageAdapter,
    setSessionDigestStorageAdapter,
} from '../services/memory/sessionDigestStorage';
import { activateAccount, clearActiveAccount } from '../services/account/accountRuntime';
import {
    createAccountScopedStorageAdapter,
    getAccountScopedStorageKeyForAccount,
} from '../services/account/accountScopedStorage';
import {
    clearMemoryFiles,
    getMemoryRecordsByIds,
    listMemoryFiles,
    MEMORY_FILE_BODY_PREFIX,
    MEMORY_FILES_MANIFEST_KEY,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
    stageTmpMemory,
} from '../services/memory/memoryFiles';

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((nextResolve) => { resolve = nextResolve; });
    return { promise, resolve };
}

function sessionDigestAdapter() {
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

describe('localBackup memory-file ownership (rule 4)', () => {
    let memoryCalls: { op: string; key: string }[];

    beforeEach(async () => {
        mockStore.clear();
        mockDelayedGet = null;
        memoryCalls = [];
        setSessionDigestStorageAdapter(sessionDigestAdapter());
        await activateAccount('backup-user');
        // The memory module's storage seam, scoped the way accountScopedStorage
        // would, recording every operation it receives.
        setMemoryFilesStorageAdapter(createAccountScopedStorageAdapter({
            getItem: async (key: string) => {
                memoryCalls.push({ op: 'get', key });
                return mockStore.get(key) ?? null;
            },
            setItem: async (key: string, value: string) => {
                memoryCalls.push({ op: 'set', key });
                mockStore.set(key, value);
            },
            removeItem: async (key: string) => {
                memoryCalls.push({ op: 'rm', key });
                mockStore.delete(key);
            },
        }, 'backup-user'));
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-02-06T12:00:00Z'));
    });

    afterEach(async () => {
        await clearActiveAccount();
        resetMemoryFilesStorageAdapter();
        resetSessionDigestStorageAdapter();
        jest.useRealTimers();
    });

    it('writes the restored manifest and body through the owning module', async () => {
        const staged = await stageTmpMemory({
            type: 'project',
            name: 'Trip planning',
            description: 'Notes about the Iceland trip',
            body: '## Trip planning\nWe booked the blue lagoon for March.',
        });
        const backup = await createLocalBackup('Memory files');
        await clearMemoryFiles();
        await expect(listMemoryFiles()).resolves.toEqual([]);

        const manifestKey = getAccountScopedStorageKeyForAccount(
            MEMORY_FILES_MANIFEST_KEY,
            'backup-user',
        );
        const bodyKey = getAccountScopedStorageKeyForAccount(
            `${MEMORY_FILE_BODY_PREFIX}${staged.id}`,
            'backup-user',
        );
        memoryCalls.length = 0; // only watch the restore from here

        await restoreLocalBackup(backup.id);

        // A raw write from localBackup is invisible to the owning module's
        // adapter; a compliant restore must be observed here.
        expect(memoryCalls).toContainEqual({ op: 'set', key: manifestKey });
        expect(memoryCalls).toContainEqual({ op: 'set', key: bodyKey });

        const records = await getMemoryRecordsByIds([staged.id]);
        expect(records).toHaveLength(1);
        expect(records[0].content).toContain('blue lagoon');
    });

    it('does not lose a file staged concurrently with a restore', async () => {
        const captured = await stageTmpMemory({
            type: 'project',
            name: 'Captured memory',
            description: 'Present when the backup was taken',
            body: '## Captured\nThis body belongs to the snapshot.',
        });
        const backup = await createLocalBackup('Snapshot with one file');
        await stageTmpMemory({
            type: 'project',
            name: 'Extra memory',
            description: 'Staged after the backup was taken',
            body: '## Extra\nThis body is not in the snapshot.',
        });

        // Hold the restore open on the snapshot body read so a staging write can
        // land in the gap between restore's read and its manifest write.
        const snapshotBodyKey = getAccountScopedStorageKeyForAccount(
            `@blackrose_local_backup_memory_file:${backup.id}:${captured.id}`,
            'backup-user',
        );
        const readStarted = deferred();
        const releaseRead = deferred();
        mockDelayedGet = {
            key: snapshotBodyKey,
            started: readStarted.resolve,
            release: releaseRead.promise,
        };

        const restoring = restoreLocalBackup(backup.id);
        await readStarted.promise;

        let laterId = '';
        const stagePromise = stageTmpMemory({
            type: 'project',
            name: 'Later memory',
            description: 'Staged while the restore was mid-flight',
            body: '## Later\nThis body is written during the restore.',
        }).then((record) => {
            laterId = record.id;
            return record;
        });

        // Drain microtasks: the pre-fix staging (no lock contention) finishes
        // here; the post-fix staging stays queued behind the restore's lock.
        for (let i = 0; i < 300; i += 1) {
            await Promise.resolve();
        }
        releaseRead.resolve();
        await stagePromise;
        await restoring;

        // The file staged during the restore must still be reachable.
        const records = await getMemoryRecordsByIds([laterId]);
        expect(records).toHaveLength(1);
        expect(records[0].content).toContain('written during the restore');
    });

    it('captures the manifest and body bytes verbatim (bundle shape unchanged)', async () => {
        const staged = await stageTmpMemory({
            type: 'project',
            name: 'Bytes',
            description: 'verbatim',
            body: '## Bytes\nverbatim payload',
        });
        const manifestKey = getAccountScopedStorageKeyForAccount(MEMORY_FILES_MANIFEST_KEY, 'backup-user');
        const bodyKey = getAccountScopedStorageKeyForAccount(
            `${MEMORY_FILE_BODY_PREFIX}${staged.id}`,
            'backup-user',
        );
        const runtimeManifest = mockStore.get(manifestKey);
        const runtimeBody = mockStore.get(bodyKey);

        const backup = await createLocalBackup('bytes');

        const indexKey = getAccountScopedStorageKeyForAccount('@blackrose_local_backups', 'backup-user');
        const stored = JSON.parse(mockStore.get(indexKey) ?? '[]') as {
            items: { key: string; value: string | null }[];
        }[];
        const item = stored[0].items.find((entry) => entry.key === MEMORY_FILES_MANIFEST_KEY);
        // The backup item is the store's own manifest payload, not a re-serialized view.
        expect(item?.value).toBe(runtimeManifest);
        // And the sharded body is the runtime body, byte for byte.
        const sharded = mockStore.get(getAccountScopedStorageKeyForAccount(
            `@blackrose_local_backup_memory_file:${backup.id}:${staged.id}`,
            'backup-user',
        ));
        expect(sharded).toBe(runtimeBody);
    });
});
