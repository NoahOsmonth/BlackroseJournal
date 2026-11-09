/**
 * One photo per entry (Kaneo #106).
 *
 * Real storage through the account adapter: the point is that a photo survives a
 * round trip, is refused when too large, and that a corrupt payload renders
 * nothing instead of throwing on a screen.
 */
import { setAccountStorageAdapter } from '../../services/account/accountScopedStorage';
import type { AccountStorageAdapter } from '../../services/account/accountScopedStorage';
import { activateAccount, clearActiveAccount } from '../../services/account/accountRuntime';
import {
    fitWithin,
    isTooLarge,
    photoStorageKey,
    PHOTO_MAX_BYTES,
    PHOTO_MAX_EDGE,
    readEntryPhoto,
    removeEntryPhoto,
    saveEntryPhoto,
} from '../../services/journal/entryPhotos';

const TINY = 'data:image/jpeg;base64,AAAA';

function memoryAdapter(): AccountStorageAdapter & { rows: Map<string, string> } {
    const rows = new Map<string, string>();
    return {
        rows,
        getItem: (k) => Promise.resolve(rows.get(k) ?? null),
        setItem: (k, v) => { rows.set(k, v); return Promise.resolve(); },
        removeItem: (k) => { rows.delete(k); return Promise.resolve(); },
    };
}

describe('photo sizing', () => {
    it('fits a wide photo inside the longest edge', () => {
        expect(fitWithin(4000, 3000, 1200)).toEqual({ width: 1200, height: 900 });
    });

    it('fits a tall photo the same way', () => {
        expect(fitWithin(900, 2400, 1200)).toEqual({ width: 450, height: 1200 });
    });

    it('never upscales a photo that is already small', () => {
        expect(fitWithin(640, 480)).toEqual({ width: 640, height: 480 });
    });

    it('survives a photo with no readable size', () => {
        expect(fitWithin(0, 0)).toEqual({ width: 0, height: 0 });
        expect(fitWithin(Number.NaN, 10)).toEqual({ width: 0, height: 0 });
    });

    it('calls a payload too large only past the ceiling', () => {
        expect(isTooLarge('x'.repeat(PHOTO_MAX_BYTES))).toBe(false);
        expect(isTooLarge('x'.repeat(PHOTO_MAX_BYTES + 1))).toBe(true);
    });

    it('keeps one key per entry, and the edge default is the documented one', () => {
        expect(photoStorageKey('entry_1')).toBe('@blackrose_entry_photo:entry_1');
        expect(PHOTO_MAX_EDGE).toBe(1200);
    });
});

describe('photo storage', () => {
    let adapter: ReturnType<typeof memoryAdapter>;

    beforeEach(async () => {
        await clearActiveAccount();
        adapter = memoryAdapter();
        setAccountStorageAdapter(adapter);
        await activateAccount('photo-account');
    });

    afterEach(async () => { await clearActiveAccount(); });

    it('round-trips a photo', async () => {
        const saved = await saveEntryPhoto('entry_1', { dataUrl: TINY, width: 1200, height: 900 });
        expect(saved).toBe(true);
        const photo = await readEntryPhoto('entry_1');
        expect(photo?.dataUrl).toBe(TINY);
        expect(photo?.width).toBe(1200);
        expect(photo?.height).toBe(900);
    });

    it('refuses a photo that is too large and leaves nothing behind', async () => {
        const huge = 'data:image/jpeg;base64,' + 'A'.repeat(PHOTO_MAX_BYTES);
        const saved = await saveEntryPhoto('entry_1', { dataUrl: huge, width: 10, height: 10 });
        expect(saved).toBe(false);
        expect(await readEntryPhoto('entry_1')).toBeNull();
    });

    it('refuses anything that is not an image', async () => {
        const saved = await saveEntryPhoto('entry_1', { dataUrl: 'javascript:alert(1)', width: 1, height: 1 });
        expect(saved).toBe(false);
    });

    it('removes a photo', async () => {
        await saveEntryPhoto('entry_1', { dataUrl: TINY, width: 10, height: 10 });
        await removeEntryPhoto('entry_1');
        expect(await readEntryPhoto('entry_1')).toBeNull();
    });

    it('reads a corrupt payload as no photo instead of throwing', async () => {
        await adapter.setItem(photoStorageKey('entry_1'), '{not json');
        await expect(readEntryPhoto('entry_1')).resolves.toBeNull();
    });

    it('ignores a payload from another schema version', async () => {
        await adapter.setItem(
            photoStorageKey('entry_1'),
            JSON.stringify({ schemaVersion: 0, dataUrl: TINY, width: 1, height: 1, updatedAt: 0 }),
        );
        expect(await readEntryPhoto('entry_1')).toBeNull();
    });

    it('has no photo for an entry that never had one', async () => {
        expect(await readEntryPhoto('entry_never')).toBeNull();
    });
});
