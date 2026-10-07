/* eslint-disable import/first */

import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('../../services/memory/localMemory', () => ({
    clearMemoryAtoms: jest.fn(),
    deleteMemoryAtom: jest.fn(),
    listMemoryAtoms: jest.fn(),
    subscribeMemoryChanges: jest.fn(() => () => undefined),
}));

jest.mock('../../services/memory/exploreNote', () => ({
    saveExploreNote: jest.fn(),
}));

jest.mock('../../services/journal/journalEntryActions', () => ({
    deleteJournalEntryWithTombstone: jest.fn(),
}));

import {
    clearMemoryAtoms,
    deleteMemoryAtom,
    listMemoryAtoms,
} from '../../services/memory/localMemory';
import { saveExploreNote } from '../../services/memory/exploreNote';
import { deleteJournalEntryWithTombstone } from '../../services/journal/journalEntryActions';
import { useLocalMemories } from '../../hooks/memory/useLocalMemories';
import type { LocalMemoryAtom } from '../../services/memory/localMemory.types';

const mockClearMemoryAtoms = jest.mocked(clearMemoryAtoms);
const mockDeleteMemoryAtom = jest.mocked(deleteMemoryAtom);
const mockListMemoryAtoms = jest.mocked(listMemoryAtoms);
const mockSaveExploreNote = jest.mocked(saveExploreNote);
const mockDeleteJournalEntryWithTombstone = jest.mocked(deleteJournalEntryWithTombstone);

function makeAtom(overrides: Partial<LocalMemoryAtom> & { id: string }): LocalMemoryAtom {
    return {
        layer: 'episodic',
        source: 'journal',
        title: 'A memory',
        content: 'Some content',
        tags: [],
        salience: 0.5,
        confidence: 0.5,
        createdAt: 1,
        updatedAt: 1,
        accessCount: 0,
        ...overrides,
    };
}

describe('useLocalMemories', () => {
    beforeEach(() => {
        mockListMemoryAtoms.mockResolvedValue([]);
        mockClearMemoryAtoms.mockResolvedValue(undefined);
        mockDeleteMemoryAtom.mockResolvedValue(true);
        mockDeleteJournalEntryWithTombstone.mockResolvedValue(true);
        mockSaveExploreNote.mockResolvedValue({
            entry: { id: 'entry_1' },
            atom: null,
            file: null,
            failures: [],
            themes: ['calm'],
        } as never);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('clears local memories and refreshes', async () => {
        const { result } = renderHook(() => useLocalMemories());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
            await result.current.clearAll();
        });

        expect(mockClearMemoryAtoms).toHaveBeenCalledTimes(1);
        expect(mockListMemoryAtoms).toHaveBeenCalledTimes(2);
    });

    it('deletes a local memory atom and refreshes', async () => {
        const { result } = renderHook(() => useLocalMemories());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
            await result.current.removeAtom('atom-1');
        });

        expect(mockDeleteMemoryAtom).toHaveBeenCalledWith('atom-1');
        expect(mockListMemoryAtoms).toHaveBeenCalledTimes(2);
    });

    it('routes a note atom through the journal-entry tombstone, not the atom delete', async () => {
        mockListMemoryAtoms.mockResolvedValue([
            makeAtom({ id: 'note-1', layer: 'note', source: 'manual', sourceId: 'entry-42' }),
        ]);
        const { result } = renderHook(() => useLocalMemories());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
            await result.current.removeAtom('note-1');
        });

        expect(mockDeleteJournalEntryWithTombstone).toHaveBeenCalledWith('entry-42');
        expect(mockDeleteMemoryAtom).not.toHaveBeenCalled();
        expect(mockListMemoryAtoms).toHaveBeenCalledTimes(2);
    });

    it('routes an extracted atom through the atom delete, never the entry tombstone', async () => {
        mockListMemoryAtoms.mockResolvedValue([
            makeAtom({ id: 'epi-1', layer: 'episodic', source: 'journal', sourceId: 'entry-42' }),
        ]);
        const { result } = renderHook(() => useLocalMemories());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
            await result.current.removeAtom('epi-1');
        });

        expect(mockDeleteMemoryAtom).toHaveBeenCalledWith('epi-1');
        expect(mockDeleteJournalEntryWithTombstone).not.toHaveBeenCalled();
    });

    it('falls back to the atom delete when a note has no resolvable entry id', async () => {
        mockListMemoryAtoms.mockResolvedValue([
            makeAtom({ id: 'note-2', layer: 'note', source: 'manual' }),
        ]);
        const { result } = renderHook(() => useLocalMemories());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
            await result.current.removeAtom('note-2');
        });

        expect(mockDeleteMemoryAtom).toHaveBeenCalledWith('note-2');
        expect(mockDeleteJournalEntryWithTombstone).not.toHaveBeenCalled();
    });

    it('keeps an Explore note through the shared write path and refreshes', async () => {
        const { result } = renderHook(() => useLocalMemories());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
            await result.current.addExploreNote('Calm mornings help.');
        });

        expect(mockSaveExploreNote).toHaveBeenCalledWith({ text: 'Calm mornings help.' });
        expect(mockListMemoryAtoms).toHaveBeenCalledTimes(2);
    });

    it('does not call the write path for blank text', async () => {
        const { result } = renderHook(() => useLocalMemories());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
            await result.current.addExploreNote('   ');
        });

        expect(mockSaveExploreNote).not.toHaveBeenCalled();
    });

    it('surfaces partial-write failures to the caller', async () => {
        mockSaveExploreNote.mockResolvedValue({
            entry: { id: 'entry_1' },
            atom: null,
            file: null,
            failures: [{ store: 'file', message: 'disk full' }],
            themes: [],
        } as never);
        const { result } = renderHook(() => useLocalMemories());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        let outcome: { failures: unknown[] } | null = null;
        await act(async () => {
            outcome = await result.current.addExploreNote('The kiln needs an element.');
        });

        expect(outcome?.failures).toHaveLength(1);
    });
});
