/* eslint-disable import/first */
import { act, renderHook } from '@testing-library/react-native';
import { REFLECTION_TIMEOUT_MS, useEntryReflection } from '../../hooks/journal/useEntryReflection';
import type { JournalEntry } from '../../services/journal/journalStorage.types';

const mockEntry: JournalEntry = {
    id: 'entry-1',
    title: 'Day at the park',
    emoji: '📝',
    createdAt: 1_000_000,
    updatedAt: 1_000_000,
    status: 'completed',
    messages: [
        { id: 'm1', role: 'user', content: 'I walked by the lake.', timestamp: 1_000_000 },
        { id: 'm2', role: 'assistant', content: 'That sounds calming.', timestamp: 1_000_100 },
    ],
};

jest.mock('../../services/ai/insights', () => ({
    generateEntryReflection: jest.fn(async () => ({
        reflection: 'You found calm near the water.',
        keyInsight: 'Being outdoors regulates your mood.',
        suggestions: [{ type: 'HABIT', text: 'Plan a weekly lakeside walk.' }],
    })),
}));

jest.mock('../../services/journal/journalStorage', () => ({
    getEntry: jest.fn(async () => mockEntry),
}));

import { generateEntryReflection } from '../../services/ai/insights';

const mockedGenerate = generateEntryReflection as jest.MockedFunction<typeof generateEntryReflection>;

describe('useEntryReflection', () => {
    beforeEach(() => {
        mockedGenerate.mockClear();
        // Each test starts with a cold module cache.
        // (Cache is module-level; number of generate calls is the observable signal.)
    });

    it('generates a reflection on mount and serves subsequent mounts from the module cache', async () => {
        const { result, unmount } = renderHook(() => useEntryReflection('entry-cached-1'));

        expect(mockedGenerate).toHaveBeenCalledTimes(0);
        await act(async () => {
            await Promise.resolve();
        });

        expect(mockedGenerate).toHaveBeenCalledTimes(1);
        expect(result.current.data).not.toBeNull();

        // A fresh mount for the same entry is served from the module cache —
        // no second AI call.
        unmount();
        const remounted = renderHook(() => useEntryReflection('entry-cached-1'));
        await act(async () => {
            await Promise.resolve();
        });
        expect(mockedGenerate).toHaveBeenCalledTimes(1);
        expect(remounted.result.current.data).not.toBeNull();
    });

    it('refresh() keeps a stable identity across renders', async () => {
        // Consumers put `refresh` in effect dependency arrays. An inline arrow
        // here re-fired the reflection screen's "analysis landed" effect on
        // every render, which queued thousands of AI requests.
        const { result, rerender } = renderHook(() => useEntryReflection('entry-stable-1'));

        await act(async () => {
            await Promise.resolve();
        });

        const firstRefresh = result.current.refresh;
        rerender({});
        rerender({});

        expect(result.current.refresh).toBe(firstRefresh);
    });

    it('collapses overlapping refresh() calls into one generation', async () => {
        const { result } = renderHook(() => useEntryReflection('entry-dedupe-1'));

        await act(async () => {
            await Promise.resolve();
        });
        expect(mockedGenerate).toHaveBeenCalledTimes(1);

        await act(async () => {
            const first = result.current.refresh();
            const second = result.current.refresh();
            await Promise.all([first, second]);
        });

        // Both callers shared one in-flight load — no second AI call.
        expect(mockedGenerate).toHaveBeenCalledTimes(2);
    });

    it('refresh() forces a fresh generation even when a cached reflection exists', async () => {
        const { result } = renderHook(() => useEntryReflection('entry-refresh-1'));

        await act(async () => {
            await Promise.resolve();
        });
        expect(mockedGenerate).toHaveBeenCalledTimes(1);

        // Change the entry so the cached reflection is stale.
        mockEntry.messages[0].content = 'I walked by the lake, then it rained heavily.';

        await act(async () => {
            await result.current.refresh();
        });

        expect(mockedGenerate).toHaveBeenCalledTimes(2);
        expect(result.current.error).toBeNull();
    });

    it('reports a timeout instead of spinning forever when the provider hangs', async () => {
        // A stalled provider used to leave `isLoading` true forever, so the
        // reflection screen sat on its skeleton with no way forward.
        jest.useFakeTimers();
        try {
            mockedGenerate.mockImplementationOnce(() => new Promise<never>(() => { }));

            const { result } = renderHook(() => useEntryReflection('entry-hang-1'));

            await act(async () => {
                await Promise.resolve();
            });
            expect(result.current.isLoading).toBe(true);

            await act(async () => {
                jest.advanceTimersByTime(REFLECTION_TIMEOUT_MS + 1);
                await Promise.resolve();
            });

            expect(result.current.isLoading).toBe(false);
            expect(result.current.data).toBeNull();
            expect(result.current.error).toBe(
                'The reflection took too long to arrive. Try again.',
            );

            // The abandoned load must not block a retry: refresh() starts a fresh
            // generation rather than joining the hung in-flight entry.
            await act(async () => {
                await result.current.refresh();
            });

            expect(mockedGenerate).toHaveBeenCalledTimes(2);
            expect(result.current.data).not.toBeNull();
            expect(result.current.error).toBeNull();
        } finally {
            jest.useRealTimers();
        }
    });
});
