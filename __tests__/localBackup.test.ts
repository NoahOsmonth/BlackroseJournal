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
    },
}));

import {
    createLocalBackup,
    listLocalBackups,
    restoreLocalBackup,
} from '../services/backup/localBackup';

describe('localBackup', () => {
    beforeEach(() => {
        mockStore.clear();
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-02-06T12:00:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('creates an on-device backup from existing local data', async () => {
        mockStore.set('@journal_entries', '{"entry-1":{"title":"Morning"}}');
        mockStore.set('@goals', '{"goal-1":{"title":"Walk"}}');
        mockStore.set('@ai_response_feedback', '{"feedback-1":{"value":"up"}}');
        mockStore.set('@rosebud_local_memory', '{"memory-1":{"title":"Rest"}}');
        mockStore.set('@blackrose_custom_ai_provider', '{"enabled":true}');

        const backup = await createLocalBackup('Friday backup');
        const backups = await listLocalBackups();

        expect(backup.name).toBe('Friday backup');
        expect(backup.itemCount).toBe(5);
        expect(backups).toEqual([backup]);
    });

    it('restores a backup and removes local keys absent from the snapshot', async () => {
        mockStore.set('@journal_entries', '{"entry-1":{"title":"Morning"}}');
        const backup = await createLocalBackup('Before edits');
        mockStore.set('@journal_entries', '{"entry-1":{"title":"Changed"}}');
        mockStore.set('@goals', '{"goal-1":{"title":"Temporary"}}');

        const result = await restoreLocalBackup(backup.id);

        expect(result.status).toBe('restored');
        expect(mockStore.get('@journal_entries')).toBe('{"entry-1":{"title":"Morning"}}');
        expect(mockStore.has('@goals')).toBe(false);
    });

    it('handles corrupt backup metadata as missing backup data', async () => {
        mockStore.set('@blackrose_local_backups', 'not-json');

        await expect(listLocalBackups()).resolves.toEqual([]);
        await expect(restoreLocalBackup('backup-missing')).resolves.toEqual({
            status: 'missing',
        });
    });
});
