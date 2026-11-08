/**
 * Starred entries storage: safe parse, serialized writes, account scoping,
 * and the schemaVersion envelope (AGENTS.md rule 4).
 */
import {
    listStarredEntryIds,
    setStarredEntryIds,
    toggleStarredEntry,
    subscribeStarredChanges,
    STARRED_ENTRIES_KEY,
} from '../../services/journal/starredEntries';

const mockGetStorageForAccount = jest.fn();
jest.mock('@/services/account/accountScopedStorage', () => ({
    getStorageForAccount: (accountId: string) => mockGetStorageForAccount(accountId),
}));

jest.mock('@/services/account/accountRuntime', () => ({
    assertAccountOperationActive: () => undefined,
    registerAccountTeardown: () => undefined,
    runAccountBoundOperation: (_name: string, operation: (context: { accountId: string }) => unknown) =>
        operation({ accountId: 'acct-test' }),
}));

/** Minimal in-file adapter — no AsyncStorage dynamic import in Jest. */
const values = new Map<string, string>();
const storage = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    removeItem: async (key: string) => { values.delete(key); },
};

beforeEach(() => {
    values.clear();
    mockGetStorageForAccount.mockReturnValue(storage);
});

describe('starredEntries storage', () => {
    it('starts empty and returns a plain list', async () => {
        expect(await listStarredEntryIds()).toEqual([]);
    });

    it('writes a schemaVersion envelope to its own key', async () => {
        await toggleStarredEntry('entry-1');
        const raw = await storage.getItem(STARRED_ENTRIES_KEY);
        expect(raw).not.toBeNull();
        const payload = JSON.parse(raw as string);
        expect(payload.schemaVersion).toBe(1);
        expect(payload.ids).toEqual(['entry-1']);
        expect(typeof payload.updatedAt).toBe('number');
    });

    it('adds then removes the same id', async () => {
        expect(await toggleStarredEntry('entry-1')).toEqual(['entry-1']);
        expect(await toggleStarredEntry('entry-1')).toEqual([]);
    });

    it('deduplicates ids and drops non-string values', async () => {
        const ids = await setStarredEntryIds(['a', 'a', 'b', '', 7 as unknown as string]);
        expect(ids).toEqual(['a', 'b']);
        expect(await listStarredEntryIds()).toEqual(['a', 'b']);
    });

    it('survives a corrupt payload instead of throwing', async () => {
        await storage.setItem(STARRED_ENTRIES_KEY, '{not json');
        expect(await listStarredEntryIds()).toEqual([]);
    });

    it('reads a legacy bare array rather than wiping it', async () => {
        await storage.setItem(STARRED_ENTRIES_KEY, JSON.stringify(['old-1', 'old-2']));
        expect(await listStarredEntryIds()).toEqual(['old-1', 'old-2']);
        expect(await toggleStarredEntry('new')).toEqual(['old-1', 'old-2', 'new']);
    });

    it('does not lose ids when two toggles overlap', async () => {
        const [a, b] = await Promise.all([
            toggleStarredEntry('entry-1'),
            toggleStarredEntry('entry-2'),
        ]);
        expect(new Set([...a, ...b])).toEqual(new Set(['entry-1', 'entry-2']));
        const final = await listStarredEntryIds();
        expect(final.sort()).toEqual(['entry-1', 'entry-2']);
    });

    it('notifies subscribers on every write and honours unsubscribe', async () => {
        const seen: string[][] = [];
        const unsubscribe = subscribeStarredChanges((ids) => seen.push([...ids]));
        await toggleStarredEntry('a');
        await setStarredEntryIds(['b', 'c']);
        unsubscribe();
        await toggleStarredEntry('d');
        expect(seen).toEqual([['a'], ['b', 'c']]);
    });

    it('a throwing listener never breaks the write', async () => {
        const unsubscribe = subscribeStarredChanges(() => { throw new Error('bad listener'); });
        expect(await toggleStarredEntry('a')).toEqual(['a']);
        unsubscribe();
        expect(await listStarredEntryIds()).toEqual(['a']);
    });
});
