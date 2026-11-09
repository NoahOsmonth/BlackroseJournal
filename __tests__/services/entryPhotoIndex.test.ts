/**
 * The photo index (Kaneo #109).
 *
 * Real storage through the account adapter. The index exists so a photos grid can
 * order by "when was this added" without reading a single photo body, and it must
 * never hide a photo whose row was lost.
 */
import { getStorageForAccount, setAccountStorageAdapter } from '../../services/account/accountScopedStorage';
import type { AccountStorageAdapter } from '../../services/account/accountScopedStorage';
import { activateAccount, clearActiveAccount } from '../../services/account/accountRuntime';
import {
    listEntryPhotoIndex,
    photoStorageKey,
    readEntryPhoto,
    removeEntryPhoto,
    saveEntryPhoto,
} from '../../services/journal/entryPhotos';

const PHOTO = (tag: string) => ({ dataUrl: 'data:image/jpeg;base64,' + tag, width: 10, height: 10 });

function memoryAdapter(): AccountStorageAdapter & { rows: Map<string, string> } {
    const rows = new Map<string, string>();
    return {
        rows,
        getItem: (k) => Promise.resolve(rows.get(k) ?? null),
        setItem: (k, v) => { rows.set(k, v); return Promise.resolve(); },
        removeItem: (k) => { rows.delete(k); return Promise.resolve(); },
        getAllKeys: () => Promise.resolve([...rows.keys()]),
    };
}

describe('photo index', () => {
    let adapter: ReturnType<typeof memoryAdapter>;

    beforeEach(async () => {
        await clearActiveAccount();
        adapter = memoryAdapter();
        setAccountStorageAdapter(adapter);
        await activateAccount('index-account');
    });
    afterEach(async () => { await clearActiveAccount(); });

    it('lists a saved photo', async () => {
        await saveEntryPhoto('entry_a', PHOTO('A'));
        const rows = await listEntryPhotoIndex();
        expect(rows.map((row) => row.entryId)).toEqual(['entry_a']);
        expect(rows[0].updatedAt).toBeGreaterThan(0);
    });

    it('puts the newest photo first', async () => {
        await saveEntryPhoto('entry_a', PHOTO('A'));
        await new Promise((resolve) => setTimeout(resolve, 5));
        await saveEntryPhoto('entry_b', PHOTO('B'));
        const rows = await listEntryPhotoIndex();
        expect(rows.map((row) => row.entryId)).toEqual(['entry_b', 'entry_a']);
    });

    it('drops the row when the photo is removed', async () => {
        await saveEntryPhoto('entry_a', PHOTO('A'));
        await removeEntryPhoto('entry_a');
        expect(await listEntryPhotoIndex()).toEqual([]);
    });

    it('finds a photo whose index row was lost, instead of hiding it', async () => {
        await saveEntryPhoto('entry_a', PHOTO('A'));
        // Simulate a lost or truncated index: the photo key is still there.
        adapter.rows.delete('@blackrose_entry_photo_index');
        const rows = await listEntryPhotoIndex();
        expect(rows.map((row) => row.entryId)).toEqual(['entry_a']);
    });

    it('drops an index row whose photo no longer exists', async () => {
        await saveEntryPhoto('entry_a', PHOTO('A'));
        // The photo vanishes without the index hearing about it (a half-write, or
        // a cleared key): the row must go, not render an empty frame.
        await getStorageForAccount('index-account').removeItem(photoStorageKey('entry_a'));
        expect(await listEntryPhotoIndex()).toEqual([]);
    });

    it('treats a corrupt index as empty rather than throwing', async () => {
        await saveEntryPhoto('entry_a', PHOTO('A'));
        adapter.rows.set('@blackrose_entry_photo_index', '{oops');
        const rows = await listEntryPhotoIndex();
        // The photo still exists on disk, so it is recovered, not lost.
        expect(rows.map((row) => row.entryId)).toEqual(['entry_a']);
        expect(await readEntryPhoto('entry_a')).not.toBeNull();
    });

    it('keeps one row per entry when a photo is replaced', async () => {
        await saveEntryPhoto('entry_a', PHOTO('A'));
        await saveEntryPhoto('entry_a', PHOTO('A2'));
        expect(await listEntryPhotoIndex()).toHaveLength(1);
    });
});
