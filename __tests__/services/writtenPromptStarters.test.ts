/**
 * Written-starter storage: safe parse, serialized writes, account scoping,
 * subscription and the schemaVersion envelope (AGENTS.md rule 4).
 */
import {
    listWrittenStarters,
    markStarterWritten,
    clearWrittenStarters,
    subscribeWrittenStarters,
    WRITTEN_STARTERS_KEY,
} from '../../services/prompts/writtenPromptStarters';

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

describe('written starter storage', () => {
    it('starts empty', async () => {
        expect(await listWrittenStarters()).toEqual([]);
    });

    it('writes a schemaVersion envelope to its own key', async () => {
        await markStarterWritten('body');
        const raw = values.get(WRITTEN_STARTERS_KEY);
        expect(raw).toBeTruthy();
        const payload = JSON.parse(raw!);
        expect(payload.schemaVersion).toBe(1);
        expect(payload.ids).toEqual(['body']);
        expect(typeof payload.updatedAt).toBe('number');
    });

    it('marking twice is a no-op, not a duplicate', async () => {
        await markStarterWritten('body');
        const first = values.get(WRITTEN_STARTERS_KEY);
        expect(await markStarterWritten('body')).toEqual(['body']);
        expect(values.get(WRITTEN_STARTERS_KEY)).toBe(first);
    });

    it('refuses an unknown starter id', async () => {
        expect(await markStarterWritten('not-a-starter')).toEqual([]);
        expect(values.has(WRITTEN_STARTERS_KEY)).toBe(false);
    });

    it('keeps earlier starters when a new one is marked', async () => {
        await markStarterWritten('body');
        expect(await markStarterWritten('worry')).toEqual(['body', 'worry']);
    });

    it('safe parse survives corrupt JSON, an array and null', async () => {
        for (const raw of ['{oops', '[]', 'null', '"text"']) {
            values.set(WRITTEN_STARTERS_KEY, raw);
            expect(await listWrittenStarters()).toEqual([]);
        }
    });

    it('drops unknown and duplicate ids from an older payload', async () => {
        values.set(WRITTEN_STARTERS_KEY, JSON.stringify({
            schemaVersion: 1, ids: ['body', 'body', 'unknown-id', '', 'worry'], updatedAt: 1,
        }));
        expect(await listWrittenStarters()).toEqual(['body', 'worry']);
        expect(await markStarterWritten('night')).toEqual(['body', 'worry', 'night']);
    });

    it('serializes overlapping marks so none is dropped', async () => {
        const [a, b] = await Promise.all([markStarterWritten('body'), markStarterWritten('worry')]);
        expect(new Set([...a, ...b])).toEqual(new Set(['body', 'worry']));
        expect(await listWrittenStarters()).toEqual(['body', 'worry']);
    });

    it('notifies subscribers on a mark and on clear', async () => {
        const seen: string[][] = [];
        const off = subscribeWrittenStarters((ids) => seen.push([...ids]));
        await markStarterWritten('body');
        await clearWrittenStarters();
        off();
        expect(seen).toEqual([['body'], []]);
    });

    it('clear writes an empty envelope, not removeItem', async () => {
        await markStarterWritten('body');
        await clearWrittenStarters();
        expect(values.has(WRITTEN_STARTERS_KEY)).toBe(true);
        expect(await listWrittenStarters()).toEqual([]);
        expect(JSON.parse(values.get(WRITTEN_STARTERS_KEY)!).ids).toEqual([]);
    });
});
