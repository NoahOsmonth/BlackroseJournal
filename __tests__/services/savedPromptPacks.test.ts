/**
 * Saved-starter storage: safe parse, serialized writes, account scoping,
 * subscription and the schemaVersion envelope (AGENTS.md rule 4).
 */
import {
    listSavedStarters,
    toggleSavedStarter,
    clearSavedStarters,
    subscribeSavedStarters,
    SAVED_STARTERS_KEY,
} from '../../services/prompts/savedPromptPacks';

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

describe('saved starter storage', () => {
    it('starts empty', async () => {
        expect(await listSavedStarters()).toEqual([]);
    });

    it('writes a schemaVersion envelope to its own key', async () => {
        await toggleSavedStarter('one-thing');
        const raw = await storage.getItem(SAVED_STARTERS_KEY);
        expect(raw).not.toBeNull();
        const payload = JSON.parse(raw as string);
        expect(payload.schemaVersion).toBe(1);
        expect(payload.ids).toEqual(['one-thing']);
        expect(typeof payload.updatedAt).toBe('number');
    });

    it('toggles on then off', async () => {
        expect(await toggleSavedStarter('grateful')).toEqual(['grateful']);
        expect(await toggleSavedStarter('grateful')).toEqual([]);
    });

    it('refuses an unknown id instead of storing it', async () => {
        expect(await toggleSavedStarter('not-a-real-starter')).toEqual([]);
        expect(await listSavedStarters()).toEqual([]);
    });

    it('survives corrupt JSON and a non-object payload', async () => {
        await storage.setItem(SAVED_STARTERS_KEY, '{broken');
        expect(await listSavedStarters()).toEqual([]);
        await storage.setItem(SAVED_STARTERS_KEY, '[1,2,3]');
        expect(await listSavedStarters()).toEqual([]);
        await storage.setItem(SAVED_STARTERS_KEY, 'null');
        expect(await listSavedStarters()).toEqual([]);
    });

    it('drops unknown and duplicate ids from an older payload', async () => {
        await storage.setItem(SAVED_STARTERS_KEY, JSON.stringify({
            schemaVersion: 1, ids: ['one-thing', 'one-thing', 'bogus', 'grateful'],
        }));
        expect(await listSavedStarters()).toEqual(['one-thing', 'grateful']);
    });

    it('serializes overlapping toggles so neither is lost', async () => {
        await Promise.all([toggleSavedStarter('one-thing'), toggleSavedStarter('grateful')]);
        expect(await listSavedStarters()).toEqual(['one-thing', 'grateful']);
    });

    it('notifies subscribers on a write and on clear', async () => {
        const seen: readonly string[][] = [];
        const stop = subscribeSavedStarters((ids) => { (seen as string[][]).push([...ids]); });
        await toggleSavedStarter('body');
        await clearSavedStarters();
        stop();
        expect(seen).toEqual([['body'], []]);
    });

    it('clear writes an empty envelope, not removeItem', async () => {
        await toggleSavedStarter('worry');
        await clearSavedStarters();
        const raw = await storage.getItem(SAVED_STARTERS_KEY);
        expect(raw).not.toBeNull();
        expect(JSON.parse(raw as string).ids).toEqual([]);
        expect(await listSavedStarters()).toEqual([]);
    });
});
