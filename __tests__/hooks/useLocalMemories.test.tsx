/* eslint-disable import/first */

import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('../../services/memory/localMemory', () => ({
    clearMemoryAtoms: jest.fn(),
    deleteMemoryAtom: jest.fn(),
    generateMemoryNoteSuggestion: jest.fn(),
    listMemoryAtoms: jest.fn(),
    saveGeneratedMemoryNote: jest.fn(),
    saveManualMemoryNote: jest.fn(),
    subscribeMemoryChanges: jest.fn(() => () => undefined),
}));

import {
    clearMemoryAtoms,
    deleteMemoryAtom,
    generateMemoryNoteSuggestion,
    listMemoryAtoms,
    saveGeneratedMemoryNote,
    saveManualMemoryNote,
} from '../../services/memory/localMemory';
import { useLocalMemories } from '../../hooks/memory/useLocalMemories';

const mockClearMemoryAtoms = jest.mocked(clearMemoryAtoms);
const mockDeleteMemoryAtom = jest.mocked(deleteMemoryAtom);
const mockGenerateMemoryNoteSuggestion = jest.mocked(generateMemoryNoteSuggestion);
const mockListMemoryAtoms = jest.mocked(listMemoryAtoms);
const mockSaveGeneratedMemoryNote = jest.mocked(saveGeneratedMemoryNote);
const mockSaveManualMemoryNote = jest.mocked(saveManualMemoryNote);

describe('useLocalMemories', () => {
    beforeEach(() => {
        mockListMemoryAtoms.mockResolvedValue([]);
        mockGenerateMemoryNoteSuggestion.mockReturnValue('Remember for Rosebud chats: rest matters.');
        mockSaveGeneratedMemoryNote.mockResolvedValue({} as never);
        mockSaveManualMemoryNote.mockResolvedValue({} as never);
        mockClearMemoryAtoms.mockResolvedValue(undefined);
        mockDeleteMemoryAtom.mockResolvedValue(true);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('loads memories and refreshes after adding notes', async () => {
        const { result } = renderHook(() => useLocalMemories());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        await act(async () => {
            await result.current.addNote('Remember slow evenings.');
        });

        expect(mockSaveManualMemoryNote).toHaveBeenCalledWith('Remember slow evenings.');
        expect(mockListMemoryAtoms).toHaveBeenCalledTimes(2);
        expect(result.current.generatedNote).toContain('rest matters');
    });

    it('saves generated memory notes through the memory framework', async () => {
        const { result } = renderHook(() => useLocalMemories());

        await waitFor(() => {
            expect(result.current.generatedNote).toContain('rest matters');
        });

        await act(async () => {
            await result.current.addGeneratedNote();
        });

        expect(mockSaveGeneratedMemoryNote)
            .toHaveBeenCalledWith('Remember for Rosebud chats: rest matters.');
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
});
