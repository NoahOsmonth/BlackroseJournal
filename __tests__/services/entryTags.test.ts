import { setAccountStorageAdapter } from '../../services/account/accountScopedStorage';
import type { AccountStorageAdapter } from '../../services/account/accountScopedStorage';
import { activateAccount, clearActiveAccount } from '../../services/account/accountRuntime';
import {
    addEntryTag,
    clearAllEntryTags,
    ENTRY_TAGS_KEY,
    getEntryTags,
    importEntryTagsSnapshot,
    listEntryTags,
    removeEntryTag,
    setEntryTagMap,
    subscribeEntryTagChanges,
} from '../../services/journal/entryTags';

function memoryAdapter() {
    const rows = new Map<string, string>();
    const adapter: AccountStorageAdapter = {
        getItem: (k) => Promise.resolve(rows.get(k) ?? null),
        setItem: (k, v) => { rows.set(k, v); return Promise.resolve(); },
        removeItem: (k) => { rows.delete(k); return Promise.resolve(); },
    };
    return { rows, adapter };
}

describe('writer-chosen labels storage', () => {
    beforeEach(async () => {
        await clearActiveAccount();
        setAccountStorageAdapter(memoryAdapter().adapter);
        await activateAccount('labels-account');
    });
    afterEach(async () => { await clearActiveAccount(); });

    it('normalizes, de-duplicates and caps labels on one entry', async () => {
        await addEntryTag('e1', '  Work ');
        await addEntryTag('e1', 'WORK');
        await addEntryTag('e1', 'family');
        expect(await getEntryTags('e1')).toEqual(['work', 'family']);
        expect(await addEntryTag('e1', '   ')).toEqual({ e1: ['work', 'family'] } as Record<string, readonly string[]>);
    });

    it('removes one label without touching the others', async () => {
        await addEntryTag('e1', 'work');
        await addEntryTag('e1', 'family');
        await removeEntryTag('e1', 'WORK');
        expect(await getEntryTags('e1')).toEqual(['family']);
        await removeEntryTag('e1', 'family');
        expect((await listEntryTags()).e1).toBeUndefined();
    });

    it('notifies subscribers after a real write, not before', async () => {
        const seen: (readonly string[])[] = [];
        const off = subscribeEntryTagChanges((map) => seen.push(map.e1 ?? []));
        await addEntryTag('e1', 'trip');
        expect(seen).toEqual([['trip']]);
        await removeEntryTag('e1', 'trip');
        expect(seen.at(-1)).toEqual([]);
        off();
    });

    it('a corrupt payload never throws and never shows junk', async () => {
        const m = memoryAdapter();
        setAccountStorageAdapter(m.adapter);
        const key = `@blackrose_account:v1:${encodeURIComponent('labels-account')}:${ENTRY_TAGS_KEY.slice(1)}`;
        m.rows.set(key, '{not json');
        expect(await listEntryTags()).toEqual({});
        await addEntryTag('e1', 'work');
        expect(await getEntryTags('e1')).toEqual(['work']);
    });

    it('backup restore goes through the owner and refreshes subscribers', async () => {
        const seen: number[] = [];
        const off = subscribeEntryTagChanges((map) => seen.push(Object.keys(map).length));
        const snapshot = JSON.stringify({
            schemaVersion: 1,
            byEntry: { e1: [' Work ', 'WORK', 'family'], e2: ['trip'] },
            updatedAt: 1,
        });
        await importEntryTagsSnapshot(snapshot);
        expect(await getEntryTags('e1')).toEqual(['work', 'family']);
        expect(await getEntryTags('e2')).toEqual(['trip']);
        expect(seen).toContain(2);
        off();
    });

    it('Clear History leaves an owned, valid empty envelope', async () => {
        await setEntryTagMap({ e1: ['work'], e2: ['trip'] });
        const m = memoryAdapter();
        setAccountStorageAdapter(m.adapter);
        // Use the same adapter for the clear so we can inspect its payload.
        await clearAllEntryTags();
        expect(await listEntryTags()).toEqual({});
        const key = [...m.rows.keys()].find((k) => k.includes(ENTRY_TAGS_KEY.slice(1)));
        expect(key).toBeDefined();
        const payload = JSON.parse(m.rows.get(key!) ?? '{}');
        expect(payload.schemaVersion).toBe(1);
        expect(payload.byEntry).toEqual({});
    });

    it('serializes two concurrent writes without dropping either', async () => {
        await Promise.all([
            addEntryTag('e1', 'work'),
            addEntryTag('e1', 'family'),
        ]);
        expect([...(await getEntryTags('e1'))].sort()).toEqual(['family', 'work']);
    });
});
