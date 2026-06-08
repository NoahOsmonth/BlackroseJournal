/* eslint-disable import/first */

import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('../../services/memory/localMemory', () => ({
    clearMemoryAtoms: jest.fn(),
    listMemoryAtoms: jest.fn(),
    saveManualMemoryNote: jest.fn(),
}));

import {
    clearMemoryAtoms,
    listMemoryAtoms,
    saveManualMemoryNote,
} from '../../services/memory/localMemory';
import { useLocalMemories } from '../../hooks/memory/useLocalMemories';

const mockClearMemoryAtoms = jest.mocked(clearMemoryAtoms);
const mockListMemoryAtoms = jest.mocked(listMemoryAtoms);
const mockSaveManualMemoryNote = jest.mocked(saveManualMemoryNote);

describe('useLocalMemories', () => {
    beforeEach(() => {
        mockListMemoryAtoms.mockResolvedValue([]);
        mockSaveManualMemoryNote.mockResolvedValue({} as never);
        mockClearMemoryAtoms.mockResolvedValue(undefined);
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
});
