import { setAccountStorageAdapter } from '../../services/account/accountScopedStorage';
import type { AccountStorageAdapter } from '../../services/account/accountScopedStorage';
import { activateAccount, clearActiveAccount } from '../../services/account/accountRuntime';
import {
    addEntryTag,
    addEntryTagToMany,
    clearAllEntryTags,
    deleteEntryTag,
    ENTRY_TAGS_KEY,
    getEntryTags,
    importEntryTagsSnapshot,
    listEntryTags,
    removeEntryTag,
    renameEntryTag,
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

describe('renaming one label across the journal', () => {
    beforeEach(async () => {
        await clearActiveAccount();
        setAccountStorageAdapter(memoryAdapter().adapter);
        await activateAccount('labels-account');
    });
    afterEach(async () => { await clearActiveAccount(); });

    it('moves every entry from the old name to the new one', async () => {
        await setEntryTagMap({ e1: ['wrok'], e2: ['wrok', 'family'], e3: ['trip'] });
        await renameEntryTag('wrok', 'work');
        expect(await getEntryTags('e1')).toEqual(['work']);
        expect([...(await getEntryTags('e2'))].sort()).toEqual(['family', 'work']);
        expect(await getEntryTags('e3')).toEqual(['trip']);
        // No trace of the typo anywhere.
        const all = await listEntryTags();
        expect(Object.values(all).flat()).not.toContain('wrok');
    });

    it('merges into a label that already exists without duplicating it', async () => {
        // e1 has BOTH names; after the merge it must carry the target once.
        const m = memoryAdapter();
        setAccountStorageAdapter(m.adapter);
        await setEntryTagMap({ e1: ['job', 'work'], e2: ['job'] });
        await renameEntryTag('job', 'work');
        expect(await getEntryTags('e1')).toEqual(['work']);
        expect(await getEntryTags('e2')).toEqual(['work']);
        // Assert the RAW stored bytes: the reader de-duplicates on parse, so a
        // stored duplicate would look correct through getEntryTags and would
        // then travel into a backup file.
        const key = [...m.rows.keys()].find((k) => k.includes(ENTRY_TAGS_KEY.slice(1)));
        const raw = JSON.parse(m.rows.get(key!) ?? '{}');
        expect(raw.byEntry.e1).toEqual(['work']);
        expect(raw.byEntry.e2).toEqual(['work']);
    });

    it('refuses an empty new name instead of deleting the label', async () => {
        await setEntryTagMap({ e1: ['work'] });
        await renameEntryTag('work', '   ');
        expect(await getEntryTags('e1')).toEqual(['work']);
    });

    it('normalizes both sides, so casing and spaces do not create a twin', async () => {
        await setEntryTagMap({ e1: ['Work'] });
        await renameEntryTag('  WORK ', '  Family  ');
        expect(await getEntryTags('e1')).toEqual(['family']);
    });

    it('is a no-op when the old name is not used, and does not notify', async () => {
        await setEntryTagMap({ e1: ['work'] });
        let notifications = 0;
        const off = subscribeEntryTagChanges(() => { notifications += 1; });
        await renameEntryTag('ghost', 'work');
        expect(notifications).toBe(0);
        expect(await getEntryTags('e1')).toEqual(['work']);
        off();
    });

    it('notifies once so a mounted screen follows the new name', async () => {
        await setEntryTagMap({ e1: ['wrok'] });
        const seen: (readonly string[])[] = [];
        const off = subscribeEntryTagChanges((map) => seen.push(map.e1 ?? []));
        await renameEntryTag('wrok', 'work');
        expect(seen).toEqual([['work']]);
        off();
    });

    it('is a no-op when the name is unchanged', async () => {
        await setEntryTagMap({ e1: ['work'] });
        let notifications = 0;
        const off = subscribeEntryTagChanges(() => { notifications += 1; });
        await renameEntryTag('work', 'WORK');
        expect(notifications).toBe(0);
        off();
    });
});

describe('deleting a label for good', () => {
    beforeEach(async () => {
        await clearActiveAccount();
        setAccountStorageAdapter(memoryAdapter().adapter);
        await activateAccount('labels-delete-account');
    });
    afterEach(async () => { await clearActiveAccount(); });

    it('drops the label from every entry and leaves the others alone', async () => {
        await setEntryTagMap({ e1: ['work'], e2: ['work', 'family'], e3: ['trip'] });
        await deleteEntryTag('work');
        expect(await getEntryTags('e1')).toEqual([]);
        expect(await getEntryTags('e2')).toEqual(['family']);
        expect(await getEntryTags('e3')).toEqual(['trip']);
    });

    it('removes an entry that has no labels left, so no empty label survives', async () => {
        const m = memoryAdapter();
        setAccountStorageAdapter(m.adapter);
        await setEntryTagMap({ e1: ['work'], e2: ['family'] });
        await deleteEntryTag('work');
        const key = [...m.rows.keys()].find((k) => k.includes(ENTRY_TAGS_KEY.slice(1)));
        const raw = JSON.parse(m.rows.get(key!) ?? '{}');
        // Assert the raw bytes: an empty array would still make the entry look tagged.
        expect(Object.keys(raw.byEntry)).toEqual(['e2']);
        expect(raw.byEntry.e2).toEqual(['family']);
    });

    it('is a no-op when no entry uses the label, and does not notify', async () => {
        await setEntryTagMap({ e1: ['work'] });
        let notifications = 0;
        const off = subscribeEntryTagChanges(() => { notifications += 1; });
        await deleteEntryTag('ghost');
        expect(notifications).toBe(0);
        off();
    });

    it('refuses an empty label instead of clearing everything', async () => {
        await setEntryTagMap({ e1: ['work'], e2: ['family'] });
        await deleteEntryTag('   ');
        expect(await getEntryTags('e1')).toEqual(['work']);
        expect(await getEntryTags('e2')).toEqual(['family']);
    });

    it('notifies once so a mounted screen stops showing the label', async () => {
        await setEntryTagMap({ e1: ['work'] });
        const seen: string[][] = [];
        const off = subscribeEntryTagChanges((map) => seen.push(Object.keys(map)));
        await deleteEntryTag('work');
        expect(seen).toEqual([[]]);
        off();
    });

    it('normalizes the label before matching, so casing still deletes', async () => {
        await setEntryTagMap({ e1: ['work'] });
        await deleteEntryTag('  WORK  ');
        expect(await getEntryTags('e1')).toEqual([]);
    });

describe('addEntryTagToMany', () => {
    beforeEach(async () => {
        await clearActiveAccount();
        setAccountStorageAdapter(memoryAdapter().adapter);
        await activateAccount('labels-many');
    });
    afterEach(async () => { await clearActiveAccount(); });

    it('adds the label to every picked entry', async () => {
        await addEntryTagToMany(['a', 'b', 'c'], 'Trip');
        expect(await getEntryTags('a')).toEqual(['trip']);
        expect(await getEntryTags('b')).toEqual(['trip']);
        expect(await getEntryTags('c')).toEqual(['trip']);
    });

    it('writes once for many entries, not once per entry', async () => {
        const { rows, adapter } = memoryAdapter();
        let writes = 0;
        setAccountStorageAdapter({
            ...adapter,
            setItem: (k, v) => { writes += 1; return adapter.setItem(k, v); },
        });
        await activateAccount('labels-many');
        await addEntryTagToMany(['a', 'b', 'c', 'd'], 'trip');
        expect(writes).toBe(1);
        expect(rows.size).toBe(1);
    });

    it('leaves entries that already carry the label untouched', async () => {
        await addEntryTag('a', 'trip');
        await addEntryTagToMany(['a', 'b'], 'trip');
        expect(await getEntryTags('a')).toEqual(['trip']);
        expect(await getEntryTags('b')).toEqual(['trip']);
    });

    it('ignores the same id twice in one call', async () => {
        await addEntryTagToMany(['a', 'a', 'a'], 'trip');
        expect(await getEntryTags('a')).toEqual(['trip']);
    });

    it('does not push an entry past its label limit', async () => {
        for (let index = 0; index < 12; index += 1) {
            await addEntryTag('full', `label${index}`);
        }
        await addEntryTagToMany(['full', 'roomy'], 'trip');
        expect(await getEntryTags('full')).toHaveLength(12);
        expect(await getEntryTags('full')).not.toContain('trip');
        expect(await getEntryTags('roomy')).toEqual(['trip']);
    });

    it('refuses an empty label and an empty id list', async () => {
        await addEntryTagToMany(['a'], '   ');
        await addEntryTagToMany([], 'trip');
        expect(await listEntryTags()).toEqual({});
    });

    it('does not notify when nothing changed', async () => {
        await addEntryTag('a', 'trip');
        const seen: unknown[] = [];
        const unsubscribe = subscribeEntryTagChanges((map) => { seen.push(map); });
        await addEntryTagToMany(['a'], 'trip');
        unsubscribe();
        expect(seen).toHaveLength(0);
    });

    it('notifies once for a batch that changes something', async () => {
        const seen: unknown[] = [];
        const unsubscribe = subscribeEntryTagChanges((map) => { seen.push(map); });
        await addEntryTagToMany(['a', 'b', 'c'], 'trip');
        unsubscribe();
        expect(seen).toHaveLength(1);
    });
});
});
