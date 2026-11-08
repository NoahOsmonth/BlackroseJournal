import { createLetter, deleteLetter, listLetters } from '@/services/letters/lettersStorage';

const mockStore = new Map<string, string>();

jest.mock('@/services/account/accountScopedStorage', () => ({
    getStorageForAccount: () => ({
        getItem: async (k: string) => mockStore.get(k) ?? null,
        setItem: async (k: string, v: string) => { mockStore.set(k, v); },
        removeItem: async (k: string) => { mockStore.delete(k); },
    }),
}));

jest.mock('@/services/account/accountRuntime', () => ({
    runAccountBoundOperation: async (_owner: string, op: () => Promise<unknown>) => op(),
    requireActiveAccountId: () => 'account-1',
}));

describe('lettersStorage', () => {
    beforeEach(() => mockStore.clear());

    it('stores a sealed letter with the day it opens', async () => {
        const created = await createLetter({ body: 'Dear future me', unlockDate: '2027-01-01' });
        const stored = await listLetters();
        expect(stored).toHaveLength(1);
        expect(stored[0].id).toBe(created.id);
        expect(stored[0].unlockDate).toBe('2027-01-01');
    });

    it('keeps every letter when two are sealed at once', async () => {
        // The queue exists for this: two load-write cycles must not clobber.
        await Promise.all([
            createLetter({ body: 'one', unlockDate: '2027-01-01' }),
            createLetter({ body: 'two', unlockDate: '2027-02-01' }),
        ]);
        const stored = await listLetters();
        expect(stored).toHaveLength(2);
    });

    it('removes only the letter asked for', async () => {
        const a = await createLetter({ body: 'a', unlockDate: '2027-01-01' });
        await createLetter({ body: 'b', unlockDate: '2027-02-01' });
        await deleteLetter(a.id);
        const stored = await listLetters();
        expect(stored.map((l) => l.body)).toEqual(['b']);
    });

    it('survives a corrupted store instead of throwing', async () => {
        mockStore.set('@blackrose_letters', '{not json');
        await expect(listLetters()).resolves.toEqual([]);
    });

    it('drops a malformed row but keeps the good ones', async () => {
        mockStore.set('@blackrose_letters', JSON.stringify({
            schemaVersion: 1,
            letters: [
                { id: 'ok', body: 'good', unlockDate: '2027-01-01', writtenDate: '2026-11-08', createdAt: 1 },
                { id: 'bad' },
            ],
        }));
        const stored = await listLetters();
        expect(stored.map((l) => l.id)).toEqual(['ok']);
    });

    it('returns nothing before anything is written', async () => {
        await expect(listLetters()).resolves.toEqual([]);
    });
});
