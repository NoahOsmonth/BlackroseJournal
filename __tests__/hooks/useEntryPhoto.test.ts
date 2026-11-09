/**
 * Adding a photo to an entry (Kaneo #106).
 *
 * The picker is mocked because it IS the platform boundary (a native sheet or a
 * file input). Storage is real, through the account adapter.
 */
/* eslint-disable import/first -- the jest.mock factories must be declared before
   the imports they replace. */
import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockPick = jest.fn<Promise<{ dataUrl: string; width: number; height: number } | null>, []>();
jest.mock('@/utils/photoPicker', () => ({
    pickEntryPhoto: () => mockPick(),
}));

import { useEntryPhoto } from '@/hooks/journal/useEntryPhoto';
import { setAccountStorageAdapter } from '../../services/account/accountScopedStorage';
import type { AccountStorageAdapter } from '../../services/account/accountScopedStorage';
import { activateAccount, clearActiveAccount } from '../../services/account/accountRuntime';
import { readEntryPhoto, saveEntryPhoto } from '../../services/journal/entryPhotos';

const PHOTO = { dataUrl: 'data:image/jpeg;base64,AAAA', width: 1200, height: 900 };

function memoryAdapter(): AccountStorageAdapter {
    const rows = new Map<string, string>();
    return {
        getItem: (k) => Promise.resolve(rows.get(k) ?? null),
        setItem: (k, v) => { rows.set(k, v); return Promise.resolve(); },
        removeItem: (k) => { rows.delete(k); return Promise.resolve(); },
    };
}

describe('useEntryPhoto', () => {
    beforeEach(async () => {
        mockPick.mockReset();
        await clearActiveAccount();
        setAccountStorageAdapter(memoryAdapter());
        await activateAccount('photo-hook-account');
    });
    afterEach(async () => { await clearActiveAccount(); });

    it('adds a picked photo and shows it', async () => {
        mockPick.mockResolvedValue(PHOTO);
        const { result } = renderHook(() => useEntryPhoto('entry_1'));

        await act(async () => { await result.current.addPhoto(); });

        await waitFor(() => expect(result.current.photo?.dataUrl).toBe(PHOTO.dataUrl));
        expect(result.current.message).toBe('Photo added.');
        expect(await readEntryPhoto('entry_1')).not.toBeNull();
    });

    it('says nothing when the writer cancels the picker', async () => {
        mockPick.mockResolvedValue(null);
        const { result } = renderHook(() => useEntryPhoto('entry_1'));

        await act(async () => { await result.current.addPhoto(); });

        expect(result.current.photo).toBeNull();
        expect(result.current.message).toBeNull();
    });

    it('explains a photo too large to keep, and stores nothing', async () => {
        mockPick.mockResolvedValue({ dataUrl: 'data:image/jpeg;base64,' + 'A'.repeat(1_000_000), width: 1, height: 1 });
        const { result } = renderHook(() => useEntryPhoto('entry_1'));

        await act(async () => { await result.current.addPhoto(); });

        expect(result.current.photo).toBeNull();
        expect(result.current.message).toBe('That photo is too big to keep. Try a smaller one.');
        expect(await readEntryPhoto('entry_1')).toBeNull();
    });

    it('loads an existing photo on mount and removes it', async () => {
        await saveEntryPhoto('entry_2', PHOTO);
        const { result } = renderHook(() => useEntryPhoto('entry_2'));
        await waitFor(() => expect(result.current.photo).not.toBeNull());

        await act(async () => { await result.current.clearPhoto(); });

        expect(result.current.photo).toBeNull();
        expect(result.current.message).toBe('Photo removed.');
        expect(await readEntryPhoto('entry_2')).toBeNull();
    });
});
