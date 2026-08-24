/* eslint-disable import/first */
jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined),
        removeItem: jest.fn(async () => undefined) },
}));

import { activateAccount, clearActiveAccount } from '../../../services/account/accountRuntime';
import { resetAccountStorageAdapter, setAccountStorageAdapter } from '../../../services/account/accountScopedStorage';
import { clearHindsightRebuildState, ensurePrivateHindsightRebuild }
    from '../../../services/memory/hindsight/hindsightRebuild';
import type { HindsightRebuildDependencies } from '../../../services/memory/hindsight/hindsightRebuild';
import type { HindsightRetainItem } from '../../../services/memory/hindsight/hindsightClient';

describe('private Hindsight rebuild', () => {
    const values = new Map<string, string>();
    const storage = {
        getItem: jest.fn(async (key: string) => values.get(key) ?? null),
        setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
        removeItem: jest.fn(async (key: string) => { values.delete(key); }),
    };
    beforeEach(async () => { values.clear(); setAccountStorageAdapter(storage); await activateAccount('account-a'); });
    afterEach(async () => { await clearActiveAccount(); resetAccountStorageAdapter(); jest.clearAllMocks(); });

    it('rebuilds once from completed history owned by the active account', async () => {
        const seenItems: HindsightRetainItem[][] = [];
        const rebuild = jest.fn(async (items: HindsightRetainItem[]) => { seenItems.push(items); return true; });
        const dependencies: HindsightRebuildDependencies = {
            listJournals: async () => [{ id: 'journal-a', title: 'A', status: 'completed' as const,
                emoji: 'A', createdAt: 10, updatedAt: 10,
                messages: [{ id: 'm1', role: 'user' as const, content: 'Journal A', timestamp: 10 }] }],
            listCheckIns: async () => [{ id: 'check-a', intentionId: 'i', type: 'morning' as const,
                title: 'Check A', summary: 'Summary A', mood: 'Calm', status: 'completed' as const,
                createdAt: 20, updatedAt: 20,
                messages: [{ id: 'm2', role: 'user' as const, content: 'Check-in A', timestamp: 20 }] }],
            rebuild, clear: jest.fn(async () => true),
        };
        await expect(ensurePrivateHindsightRebuild('account-a', dependencies)).resolves.toBe('rebuilt');
        await expect(ensurePrivateHindsightRebuild('account-a', dependencies)).resolves.toBe('already-complete');
        expect(rebuild).toHaveBeenCalledTimes(1);
        expect(seenItems[0]?.map((item) => item.document_id)).toEqual([
            'journal_entry:journal-a', 'intention_checkin:check-a',
        ]);
    });

    it('does not mark a failed rebuild complete and retries later', async () => {
        const rebuild = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
        const dependencies: HindsightRebuildDependencies = {
            listJournals: async () => [], listCheckIns: async () => [{ id: 'check-a', intentionId: 'i',
                type: 'evening' as const, title: 'Check', summary: 'Summary', mood: 'Calm',
                status: 'completed' as const, createdAt: 20, updatedAt: 20, messages: [] }],
            rebuild, clear: jest.fn(async () => true),
        };
        await expect(ensurePrivateHindsightRebuild('account-a', dependencies)).resolves.toBe('failed');
        await expect(ensurePrivateHindsightRebuild('account-a', dependencies)).resolves.toBe('rebuilt');
        expect(rebuild).toHaveBeenCalledTimes(2);
    });

    it('rejects a stale account before private history can cross an account switch', async () => {
        await expect(ensurePrivateHindsightRebuild('account-b', {
            listJournals: async () => { throw new Error('must not read'); },
            listCheckIns: async () => { throw new Error('must not read'); },
            rebuild: async () => true, clear: async () => true,
        })).resolves.toBe('stale-account');
    });

    it('clears its account-scoped completion marker', async () => {
        await storage.setItem('@blackrose_account:v1:account-a:blackrose_hindsight_rebuild', '{"x":1}');
        await clearHindsightRebuildState();
        expect(values.size).toBe(0);
    });
});
