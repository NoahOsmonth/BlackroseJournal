/* eslint-disable import/first */
import { act, renderHook } from '@testing-library/react-native';
import { useEntryReflection } from '../../hooks/journal/useEntryReflection';
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

    it('refresh() forces a fresh generation even when a cached reflection exists', async () => {
        const { result, rerender } = renderHook(() => useEntryReflection('entry-refresh-1'));

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
});