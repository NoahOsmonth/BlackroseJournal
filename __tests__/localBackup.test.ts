/* eslint-disable import/first */

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
    createLocalBackup,
    listLocalBackups,
    restoreLocalBackup,
} from '../services/backup/localBackup';
import {
    resetSessionDigestStorageAdapter,
    setSessionDigestStorageAdapter,
} from '../services/memory/sessionDigestStorage';
import { activateAccount, clearActiveAccount } from '../services/account/accountRuntime';
import { getAccountScopedStorageKey } from '../services/account/accountScopedStorage';

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
        mockStore.set('@ai_response_feedback', '{"feedback-1":{"value":"up"}}');
        mockStore.set('@rosebud_local_memory', '{"memory-1":{"title":"Rest"}}');
        mockStore.set('@blackrose_custom_ai_provider', '{"enabled":true}');
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
        expect(mockStore.get(journalKey)).toBe('{"entry-1":{"title":"Morning"}}');
        expect(mockStore.has(goalsKey)).toBe(false);
    });

    it('handles corrupt backup metadata as missing backup data', async () => {
        mockStore.set('@blackrose_local_backups', 'not-json');

        await expect(listLocalBackups()).resolves.toEqual([]);
        await expect(restoreLocalBackup('backup-missing')).resolves.toEqual({
            status: 'missing',
        });
    });
});
