import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueueSyncTask, flushSyncQueue } from '../../services/supabase/syncQueue';
import { ensureSupabaseSession } from '../../services/supabase/supabaseClient';

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
}));

jest.mock('../../services/supabase/supabaseClient', () => ({
    ensureSupabaseSession: jest.fn(),
}));

describe('supabase sync queue', () => {
    const storage: Record<string, string> = {};

    beforeEach(() => {
        jest.clearAllMocks();
        Object.keys(storage).forEach((key) => delete storage[key]);
        (AsyncStorage.getItem as jest.Mock).mockImplementation(
            async (key: string) => storage[key] ?? null
        );
        (AsyncStorage.setItem as jest.Mock).mockImplementation(
            async (key: string, value: string) => {
                storage[key] = value;
            }
        );
    });

    it('dedupes tasks with the same key', async () => {
        (ensureSupabaseSession as jest.Mock).mockResolvedValue(null);

        await enqueueSyncTask({
            table: 'journal_entries',
            operation: 'upsert',
            payload: { id: 'entry-1' },
            onConflict: 'id',
        });

        await enqueueSyncTask({
            table: 'journal_entries',
            operation: 'upsert',
            payload: { id: 'entry-1' },
            onConflict: 'id',
        });

        const queue = JSON.parse(storage['@supabase_sync_queue']);
        expect(queue).toHaveLength(1);
        expect(queue[0].table).toBe('journal_entries');
    });

    it('flushes queued tasks to supabase', async () => {
        const upsert = jest.fn().mockResolvedValue({ error: null });
        const eq = jest.fn().mockResolvedValue({ error: null });
        const deleteFn = jest.fn(() => ({ eq }));
        const from = jest.fn(() => ({ upsert, delete: deleteFn }));

        (ensureSupabaseSession as jest.Mock).mockResolvedValue({ from });

        await enqueueSyncTask({
            table: 'journal_entries',
            operation: 'upsert',
            payload: { id: 'entry-2' },
            onConflict: 'id',
        });

        await enqueueSyncTask({
            table: 'journal_entries',
            operation: 'delete',
            primaryKey: 'id',
            primaryValue: 'entry-3',
        });

        await flushSyncQueue();

        expect(from).toHaveBeenCalledWith('journal_entries');
        expect(upsert).toHaveBeenCalled();
        expect(deleteFn).toHaveBeenCalled();
        expect(eq).toHaveBeenCalledWith('id', 'entry-3');
    });
});
