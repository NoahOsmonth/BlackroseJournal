/* eslint-disable import/first */

const mockGetItem = jest.fn().mockResolvedValue(null);
const mockSetItem = jest.fn().mockResolvedValue(undefined);

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: mockGetItem,
        setItem: mockSetItem,
    },
}));

const mockEnsureSupabaseSession = jest.fn();

jest.mock('../services/supabase/supabaseClient', () => ({
    ensureSupabaseSession: mockEnsureSupabaseSession,
}));

import { enqueueSyncTask, flushSyncQueue } from '../services/supabase/syncQueue';

describe('syncQueue local-only default', () => {
    const originalDataProvider = process.env.EXPO_PUBLIC_DATA_PROVIDER;
    const originalRemoteFlag = process.env.EXPO_PUBLIC_ENABLE_REMOTE_DATA_SYNC;

    afterEach(() => {
        process.env.EXPO_PUBLIC_DATA_PROVIDER = originalDataProvider;
        process.env.EXPO_PUBLIC_ENABLE_REMOTE_DATA_SYNC = originalRemoteFlag;
        mockGetItem.mockClear();
        mockSetItem.mockClear();
        mockEnsureSupabaseSession.mockClear();
    });

    it('does not persist or flush remote tasks in local-only mode', async () => {
        delete process.env.EXPO_PUBLIC_DATA_PROVIDER;
        delete process.env.EXPO_PUBLIC_ENABLE_REMOTE_DATA_SYNC;

        const task = await enqueueSyncTask({
            table: 'journal_entries',
            operation: 'upsert',
            payload: { id: 'entry-1' },
        });
        await flushSyncQueue();

        expect(task.table).toBe('journal_entries');
        expect(mockSetItem).not.toHaveBeenCalled();
        expect(mockEnsureSupabaseSession).not.toHaveBeenCalled();
    });
});
