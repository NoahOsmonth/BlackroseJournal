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

import {
    clearMemoryAtoms,
    deleteMemoryAtom,
    listMemoryAtoms,
} from '../../services/memory/localMemory';
import { saveExploreNote } from '../../services/memory/exploreNote';
import { useLocalMemories } from '../../hooks/memory/useLocalMemories';

const mockClearMemoryAtoms = jest.mocked(clearMemoryAtoms);
const mockDeleteMemoryAtom = jest.mocked(deleteMemoryAtom);
const mockListMemoryAtoms = jest.mocked(listMemoryAtoms);
const mockSaveExploreNote = jest.mocked(saveExploreNote);

describe('useLocalMemories', () => {
    beforeEach(() => {
        mockListMemoryAtoms.mockResolvedValue([]);
        mockClearMemoryAtoms.mockResolvedValue(undefined);
        mockDeleteMemoryAtom.mockResolvedValue(true);
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
