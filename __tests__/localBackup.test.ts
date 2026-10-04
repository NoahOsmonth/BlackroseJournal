/* eslint-disable import/first */

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

import {
    createLocalBackup,
    listLocalBackups,
    restoreLocalBackup,
} from '../services/backup/localBackup';
import {
    resetSessionDigestStorageAdapter,
    setSessionDigestStorageAdapter,
} from '../services/memory/sessionDigestStorage';
import {
    activateAccount,
    clearActiveAccount,
    getActiveAccountId,
} from '../services/account/accountRuntime';
import {
    getAccountScopedStorageKey,
    getAccountScopedStorageKeyForAccount,
} from '../services/account/accountScopedStorage';
import {
    getEntry as getJournalEntry,
    resetStorageAdapter as resetJournalStorageAdapter,
    setStorageAdapter as setJournalStorageAdapter,
} from '../services/journal/journalStorage';
import { createGoal, subscribeGoalsChanges } from '../services/goals/goalsStorage';
import {
    MEMORY_FILE_BODY_PREFIX,
    MEMORY_FILES_MANIFEST_KEY,
    clearMemoryFiles,
    getMemoryRecordsByIds,
    listMemoryFiles,
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

describe('localBackup', () => {
    beforeEach(async () => {
        mockStore.clear();
        mockDelayedGet = null;
        setSessionDigestStorageAdapter(sessionDigestAdapter());
        await activateAccount('backup-user');
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-02-06T12:00:00Z'));
    });

    afterEach(async () => {
        await clearActiveAccount();
        resetSessionDigestStorageAdapter();
        jest.useRealTimers();
    });

    it('creates an on-device backup from existing local data', async () => {
        mockStore.set(getAccountScopedStorageKey('@journal_entries'), '{"entry-1":{"title":"Morning"}}');
        mockStore.set(getAccountScopedStorageKey('@goals'), '{"goal-1":{"title":"Walk"}}');
        mockStore.set(getAccountScopedStorageKey('@ai_response_feedback'), '{"feedback-1":{"value":"up"}}');
        // A pre-shard v2 payload at the memory key: the backup must fold it in and
        // carry the atoms, not just the header that replaces it at runtime.
        mockStore.set(getAccountScopedStorageKey('@rosebud_local_memory'), JSON.stringify({
            schemaVersion: 2,
            atoms: {
                'journal:episodic:memory-1': {
                    id: 'journal:episodic:memory-1',
                    layer: 'episodic',
                    source: 'journal',
                    sourceId: 'memory-1',
                    title: 'Rest',
                    content: 'Rest well.',
                    tags: [],
                    salience: 0.5,
                    confidence: 0.5,
                    createdAt: 1,
                    updatedAt: 1,
                    accessCount: 0,
                },
            },
        }));
        mockStore.set(getAccountScopedStorageKey('@blackrose_custom_ai_provider'), '{"enabled":true}');
        mockStore.set('@blackrose_color_theme', '{"schemaVersion":1}');

        const backup = await createLocalBackup('Friday backup');
        const backups = await listLocalBackups();

        expect(backup.name).toBe('Friday backup');
        expect(backup.itemCount).toBe(6);
        expect(backups).toEqual([backup]);
    });

    it('restores a backup and removes local keys absent from the snapshot', async () => {
        const journalKey = getAccountScopedStorageKey('@journal_entries');
        const goalsKey = getAccountScopedStorageKey('@goals');
        mockStore.set(journalKey, '{"entry-1":{"title":"Morning"}}');
        const backup = await createLocalBackup('Before edits');
        mockStore.set(journalKey, '{"entry-1":{"title":"Changed"}}');
        mockStore.set(goalsKey, '{"goal-1":{"title":"Temporary"}}');

        const result = await restoreLocalBackup(backup.id);

        expect(result.status).toBe('restored');
        // The journal store is sharded: the scoped key now holds the lightweight
        // index, and the entry body lives in a shard. Restore is verified through
        // the owning module rather than by reading the raw key.
        expect(mockStore.get(journalKey)).toContain('"shardCount"');
        await expect(getJournalEntry('entry-1')).resolves.toEqual({ title: 'Morning' });
        expect(mockStore.has(goalsKey)).toBe(false);
    });

    it('handles corrupt backup metadata as missing backup data', async () => {
        mockStore.set(getAccountScopedStorageKey('@blackrose_local_backups'), 'not-json');

        await expect(listLocalBackups()).resolves.toEqual([]);
        await expect(restoreLocalBackup('backup-missing')).resolves.toEqual({
            status: 'missing',
        });
    });

    it('rejects backup metadata created by a different account', async () => {
        const userAJournalKey = getAccountScopedStorageKey('@journal_entries');
        mockStore.set(userAJournalKey, '{"entry-a":{"title":"A"}}');
        const backup = await createLocalBackup('User A');
        const userAIndex = mockStore.get(
            getAccountScopedStorageKey('@blackrose_local_backups')
        ) ?? '';

        await activateAccount('user-b');
        const userBJournalKey = getAccountScopedStorageKey('@journal_entries');
        mockStore.set(userBJournalKey, '{"entry-b":{"title":"B"}}');
        mockStore.set(getAccountScopedStorageKey('@blackrose_local_backups'), userAIndex);

        await expect(restoreLocalBackup(backup.id)).resolves.toEqual({
            status: 'account-mismatch',
        });
        expect(mockStore.get(userBJournalKey)).toBe('{"entry-b":{"title":"B"}}');
    });

    it('rejects a backup create that becomes stale during its snapshot read', async () => {
        const readStarted = deferred();
        const releaseRead = deferred();
        const accountAJournalKey = getAccountScopedStorageKeyForAccount(
            '@journal_entries',
            'backup-user',
        );
        mockStore.set(accountAJournalKey, '{"entry-a":{"title":"A"}}');
        mockDelayedGet = {
            key: accountAJournalKey,
            started: readStarted.resolve,
            release: releaseRead.promise,
        };

        const creating = createLocalBackup('stale create');
        await readStarted.promise;
        const switching = activateAccount('other-user');
        releaseRead.resolve();

        await expect(creating).rejects.toThrow('Account operation was aborted.');
        await switching;
        expect(mockStore.has(getAccountScopedStorageKeyForAccount(
            '@blackrose_local_backups',
            'backup-user',
        ))).toBe(false);
        expect(mockStore.has(getAccountScopedStorageKeyForAccount(
            '@blackrose_local_backups',
            'other-user',
        ))).toBe(false);
    });

    it('rejects a backup restore that becomes stale before importing its snapshot', async () => {
        const accountAJournalKey = getAccountScopedStorageKeyForAccount(
            '@journal_entries',
            'backup-user',
        );
        const accountAPersonasKey = getAccountScopedStorageKeyForAccount(
            '@personas',
            'backup-user',
        );
        const accountABackupIndexKey = getAccountScopedStorageKeyForAccount(
            '@blackrose_local_backups',
            'backup-user',
        );
        mockStore.set(accountAJournalKey, '{"entry-a":{"title":"Before"}}');
        mockStore.set(accountAPersonasKey, '{"persona-a":{"name":"Before"}}');
        const backup = await createLocalBackup('stale restore');
        mockStore.set(accountAJournalKey, '{"entry-a":{"title":"Current"}}');
        mockStore.set(accountAPersonasKey, '{"persona-a":{"name":"Current"}}');

        const readStarted = deferred();
        const releaseRead = deferred();
        mockDelayedGet = {
            key: accountABackupIndexKey,
            started: readStarted.resolve,
            release: releaseRead.promise,
        };
        const restoring = restoreLocalBackup(backup.id);
        await readStarted.promise;
        const switching = activateAccount('other-user');
        releaseRead.resolve();

        await expect(restoring).rejects.toThrow();
        await switching;
        expect(mockStore.get(accountAJournalKey)).toBe('{"entry-a":{"title":"Current"}}');
        expect(mockStore.get(accountAPersonasKey)).toBe('{"persona-a":{"name":"Current"}}');
        expect(mockStore.has(getAccountScopedStorageKeyForAccount(
            '@journal_entries',
            'other-user',
        ))).toBe(false);
    });

    it('restores account-owned goals through the owner import notification path', async () => {
        await createGoal({ title: 'Backed up goal', type: 'goal' });
        const backup = await createLocalBackup('Goals');
        await createGoal({ title: 'Later goal', type: 'goal' });
        const listener = jest.fn();
        const unsubscribe = subscribeGoalsChanges(listener);

        await restoreLocalBackup(backup.id);

        expect(listener).toHaveBeenCalled();
        unsubscribe();
    });

    it('round-trips the offline memory files so a restore keeps search working', async () => {
        const staged = await stageTmpMemory({
            type: 'project',
            name: 'Trip planning',
            description: 'Notes about the Iceland trip',
            body: '## Trip planning\nWe booked the blue lagoon for March.',
        });
        const manifestKey = getAccountScopedStorageKey(MEMORY_FILES_MANIFEST_KEY);
        const runtimeBodyKey = getAccountScopedStorageKey(
            `${MEMORY_FILE_BODY_PREFIX}${staged.id}`,
        );
        // Precondition: the searchable layer is actually present before the backup.
        expect(mockStore.get(manifestKey)).toBeTruthy();
        expect(mockStore.get(runtimeBodyKey)).toContain('blue lagoon');

        const backup = await createLocalBackup('Memory files');
        // The body is sharded into the backup under its own key, not packed in.
        const shardedKey = getAccountScopedStorageKeyForAccount(
            `@blackrose_local_backup_memory_file:${backup.id}:${staged.id}`,
            'backup-user',
        );
        expect(mockStore.get(shardedKey)).toContain('blue lagoon');

        // Wipe the on-device layer — what a fresh-install restore faces.
        await clearMemoryFiles();
        await expect(listMemoryFiles()).resolves.toEqual([]);
        expect(mockStore.has(runtimeBodyKey)).toBe(false);

        const result = await restoreLocalBackup(backup.id);

        expect(result.status).toBe('restored');
        // The manifest index is back...
        const restoredHeaders = await listMemoryFiles();
        expect(restoredHeaders.map((h) => h.id)).toContain(staged.id);
        // ...and the body is readable — exactly what memory_search -> memory_get needs.
        const records = await getMemoryRecordsByIds([staged.id]);
        expect(records).toHaveLength(1);
        expect(records[0].content).toContain('blue lagoon');
    });

    it('removes the runtime memory manifest when the backup captured none', async () => {
        const backup = await createLocalBackup('No memory files');
        await stageTmpMemory({
            type: 'project',
            name: 'After backup',
            description: 'Staged after the snapshot',
            body: '## After backup\nThis should not survive the restore.',
        });
        const manifestKey = getAccountScopedStorageKey(MEMORY_FILES_MANIFEST_KEY);
        expect(mockStore.get(manifestKey)).toBeTruthy();

        await restoreLocalBackup(backup.id);

        expect(mockStore.has(manifestKey)).toBe(false);
    });

    it('leaves the runtime memory manifest intact when restoring a pre-change v2 backup', async () => {
        const staged = await stageTmpMemory({
            type: 'project',
            name: 'Pre-change memory',
            description: 'Captured before memory-file backups existed',
            body: '## Pre-change\nA file the older format never captured.',
        });
        const manifestKey = getAccountScopedStorageKey(MEMORY_FILES_MANIFEST_KEY);
        const backup = await createLocalBackup('Pre-change format');

        // Downgrade the stored record to the pre-change v2 shape: it predates
        // memory-file capture, so it carries no MEMORY_FILES_MANIFEST_KEY item.
        const indexKey = getAccountScopedStorageKeyForAccount(
            '@blackrose_local_backups',
            'backup-user',
        );
        const stored = JSON.parse(mockStore.get(indexKey) ?? '[]') as Record<string, unknown>[];
        stored[0].schemaVersion = 2;
        stored[0].items = (stored[0].items as { key: string }[]).filter(
            (item) => item.key !== MEMORY_FILES_MANIFEST_KEY,
        );
        mockStore.set(indexKey, JSON.stringify(stored));

        const runtimeManifestBefore = mockStore.get(manifestKey);
        expect(runtimeManifestBefore).toBeTruthy();
        const runtimeBodyKey = getAccountScopedStorageKey(
            `${MEMORY_FILE_BODY_PREFIX}${staged.id}`,
        );
        expect(mockStore.get(runtimeBodyKey)).toContain('older format never captured');

        await restoreLocalBackup(backup.id);

        // Absent item means "old format", not "empty snapshot": nothing is wiped.
        expect(mockStore.get(manifestKey)).toBe(runtimeManifestBefore);
        expect(mockStore.get(runtimeBodyKey)).toContain('older format never captured');
    });

    it('removes the runtime index and every body when a v3 backup captured zero files', async () => {
        const backup = await createLocalBackup('No memory files at all');
        const staged = await stageTmpMemory({
            type: 'project',
            name: 'Staged later',
            description: 'Arrived after the empty snapshot',
            body: '## Staged later\nThese bytes are outside the snapshot.',
        });
        const manifestKey = getAccountScopedStorageKey(MEMORY_FILES_MANIFEST_KEY);
        const runtimeBodyKey = getAccountScopedStorageKey(
            `${MEMORY_FILE_BODY_PREFIX}${staged.id}`,
        );
        expect(mockStore.get(manifestKey)).toBeTruthy();
        expect(mockStore.has(runtimeBodyKey)).toBe(true);

        await restoreLocalBackup(backup.id);

        expect(mockStore.has(manifestKey)).toBe(false);
        expect(mockStore.has(runtimeBodyKey)).toBe(false);
    });

    it('removes runtime bodies the v3 backup does not contain', async () => {
        const captured = await stageTmpMemory({
            type: 'project',
            name: 'Captured memory',
            description: 'Present when the backup was taken',
            body: '## Captured\nThis body belongs to the snapshot.',
        });
        const backup = await createLocalBackup('Snapshot with one file');
        const extra = await stageTmpMemory({
            type: 'project',
            name: 'Extra memory',
            description: 'Staged after the backup was taken',
            body: '## Extra\nThis body is not in the snapshot.',
        });
        const capturedBodyKey = getAccountScopedStorageKey(
            `${MEMORY_FILE_BODY_PREFIX}${captured.id}`,
        );
        const extraBodyKey = getAccountScopedStorageKey(
            `${MEMORY_FILE_BODY_PREFIX}${extra.id}`,
        );
        expect(mockStore.has(capturedBodyKey)).toBe(true);
        expect(mockStore.has(extraBodyKey)).toBe(true);

        const result = await restoreLocalBackup(backup.id);

        expect(result.status).toBe('restored');
        // The snapshot's body is back and readable...
        expect(mockStore.get(capturedBodyKey)).toContain('belongs to the snapshot');
        // ...and the body the snapshot never contained is gone, not left behind.
        expect(mockStore.has(extraBodyKey)).toBe(false);
        const headers = await listMemoryFiles({ limit: 50 });
        expect(headers.map((h) => h.id)).toEqual([captured.id]);
    });
});

describe('local backup delegated restore races', () => {
    beforeEach(async () => {
        mockStore.clear();
        mockDelayedGet = null;
        setSessionDigestStorageAdapter(sessionDigestAdapter());
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-02-06T12:00:00Z'));
        await activateAccount('backup-user');
    });

    afterEach(async () => {
        await clearActiveAccount();
        resetSessionDigestStorageAdapter();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('keeps a delegated restore bound to the account that started it', async () => {
        const journalKey = getAccountScopedStorageKeyForAccount('@journal_entries', 'backup-user');
        mockStore.set(journalKey, '{"entry-a":{"title":"A"}}');
        const backup = await createLocalBackup('Delegated restore');
        const delayedWrite = deferred();
        let importAccountId: string | null | undefined;
        let writeStarted = false;

        setJournalStorageAdapter({
            getItem: async (key) => mockStore.get(key) ?? null,
            setItem: async (key, value) => {
                if (key === journalKey) {
                    importAccountId = getActiveAccountId();
                    writeStarted = true;
                    await delayedWrite.promise;
                }
                mockStore.set(key, value);
            },
            removeItem: async (key) => {
                mockStore.delete(key);
            },
        });

        jest.useRealTimers();
        const restoring = restoreLocalBackup(backup.id).catch((error) => error);
        while (!writeStarted) {
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        const switching = activateAccount('other-user');
        delayedWrite.resolve();

        const result = await restoring;
        await switching;
        expect(result).toBeInstanceOf(Error);
        expect((result as Error).message).toBe('Account operation was aborted.');
        expect(importAccountId).toBe('backup-user');
        expect(getActiveAccountId()).toBe('other-user');
        expect(mockStore.has(getAccountScopedStorageKeyForAccount(
            '@journal_entries',
            'other-user',
        ))).toBe(false);
        resetJournalStorageAdapter();
    });
});
