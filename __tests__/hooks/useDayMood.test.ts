/**
 * Real behavior: the row must follow the store, and tapping the feeling that is
 * already chosen must take it back off (the store never sees a "same" write).
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { setAccountStorageAdapter } from '../../services/account/accountScopedStorage';
import type { AccountStorageAdapter } from '../../services/account/accountScopedStorage';
import { activateAccount, clearActiveAccount } from '../../services/account/accountRuntime';
import { useDayMood } from '../../hooks/today/useDayMood';
import { readDayMood, setDayMoodFeeling } from '../../services/journal/dayMood';

const DAY = '2026-11-09';

function memoryAdapter(): AccountStorageAdapter {
    const rows = new Map<string, string>();
    return {
        getItem: (k) => Promise.resolve(rows.get(k) ?? null),
        setItem: (k, v) => { rows.set(k, v); return Promise.resolve(); },
        removeItem: (k) => { rows.delete(k); return Promise.resolve(); },
    };
}

describe('useDayMood', () => {
    beforeEach(async () => {
        await clearActiveAccount();
        setAccountStorageAdapter(memoryAdapter());
        await activateAccount('mood-hook-account');
    });
    afterEach(async () => { await clearActiveAccount(); });

    it('shows a feeling written straight through the service', async () => {
        const { result } = renderHook(() => useDayMood(DAY));
        await waitFor(() => expect(result.current.moodId).toBeNull());
        await act(async () => { await setDayMoodFeeling(DAY, 'light'); });
        await waitFor(() => expect(result.current.moodId).toBe('light'));
    });

    it('tapping the chosen feeling again clears it', async () => {
        const { result } = renderHook(() => useDayMood(DAY));
        await act(async () => { result.current.setFeeling('calm'); });
        await waitFor(() => expect(result.current.moodId).toBe('calm'));
        await act(async () => { result.current.setFeeling('calm'); });
        await waitFor(() => expect(result.current.moodId).toBeNull());
        expect(await readDayMood(DAY)).toBeNull();
    });

    it('a cause can be added and taken off without touching the feeling', async () => {
        const { result } = renderHook(() => useDayMood(DAY));
        await act(async () => { result.current.setFeeling('mixed'); });
        await act(async () => { result.current.toggleFactor('people'); });
        await waitFor(() => expect(result.current.factorIds).toEqual(['people']));
        await act(async () => { result.current.toggleFactor('people'); });
        await waitFor(() => expect(result.current.factorIds).toEqual([]));
        expect(result.current.moodId).toBe('mixed');
    });

    it('a slow first read does not wipe a tap made while it was loading', async () => {
        // The store ends up correct but the row showed nothing until this was fixed:
        // the mount read resolved after the write and set the row back to null.
        const { result } = renderHook(() => useDayMood(DAY));
        act(() => { result.current.setFeeling('calm'); });
        await waitFor(() => expect(result.current.moodId).toBe('calm'));
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 40)); });
        expect(result.current.moodId).toBe('calm');
    });

    it('ignores another day entirely', async () => {
        const { result } = renderHook(() => useDayMood(DAY));
        await act(async () => { await setDayMoodFeeling('2026-11-01', 'heavy'); });
        expect(result.current.moodId).toBeNull();
    });
});
