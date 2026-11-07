import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useEntryTaskSuggestions } from '@/hooks/tasks/useEntryTaskSuggestions';

const mockExtract = jest.fn();
const mockListGoals = jest.fn();
const mockCreateGoal = jest.fn();

jest.mock('@/services/tasks/taskExtraction', () => ({
    extractTasksForEntry: (...args: unknown[]) => mockExtract(...args),
}));
jest.mock('@/services/goals/goalsStorage', () => ({
    listGoals: () => mockListGoals(),
    createGoal: (...args: unknown[]) => mockCreateGoal(...args),
}));

const ENTRY = 'Talked with mum about the roof. I have to call the roofer on Monday and book a haircut before the trip.';

describe('useEntryTaskSuggestions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockListGoals.mockResolvedValue([]);
        mockCreateGoal.mockResolvedValue({ id: 'g1' });
        mockExtract.mockResolvedValue(['Call the roofer', 'Book a haircut']);
    });

    it('offers what the entry implies, without writing anything', async () => {
        const { result } = renderHook(() => useEntryTaskSuggestions({
            entryId: 'e1', entryText: ENTRY, dateKey: '2026-11-08',
        }));

        await waitFor(() => expect(result.current.suggestions).toHaveLength(2));
        expect(mockExtract).toHaveBeenCalledTimes(1);
        expect(mockCreateGoal).not.toHaveBeenCalled();
    });

    it('drops a task the writer already has', async () => {
        mockListGoals.mockResolvedValue([{ id: 'g0', title: 'book a haircut', type: 'goal' }]);
        mockExtract.mockResolvedValue(['Call the roofer', 'Book a haircut']);

        const { result } = renderHook(() => useEntryTaskSuggestions({
            entryId: 'e2', entryText: ENTRY,
        }));

        await waitFor(() => expect(result.current.suggestions).toEqual(['Call the roofer']));
    });

    it('saves a kept task as a goal and takes it off the list', async () => {
        const { result } = renderHook(() => useEntryTaskSuggestions({
            entryId: 'e3', entryText: ENTRY, dateKey: '2026-11-08',
        }));
        await waitFor(() => expect(result.current.suggestions).toHaveLength(2));

        await act(async () => { await result.current.keep('Call the roofer'); });

        expect(mockCreateGoal).toHaveBeenCalledWith({
            title: 'Call the roofer', type: 'goal', dateKey: '2026-11-08',
        });
        expect(result.current.kept).toEqual(['Call the roofer']);
        expect(result.current.suggestions).toEqual(['Book a haircut']);
    });

    it('asks once per entry, not on every render', async () => {
        const { result, rerender } = renderHook(() => useEntryTaskSuggestions({
            entryId: 'e4', entryText: ENTRY,
        }));
        await waitFor(() => expect(result.current.suggestions).toHaveLength(2));
        rerender({});
        rerender({});
        expect(mockExtract).toHaveBeenCalledTimes(1);
    });

    it('says plainly when a task could not be saved', async () => {
        mockCreateGoal.mockRejectedValue(new Error('storage down'));
        const { result } = renderHook(() => useEntryTaskSuggestions({
            entryId: 'e5', entryText: ENTRY,
        }));
        await waitFor(() => expect(result.current.suggestions).toHaveLength(2));

        await act(async () => { await result.current.keep('Call the roofer'); });

        expect(result.current.error).toBe('Could not add that task. Please try again.');
        expect(result.current.kept).toEqual([]);
    });

    it('stays silent when the AI is switched off', () => {
        renderHook(() => useEntryTaskSuggestions({
            entryId: 'e6', entryText: ENTRY, enabled: false,
        }));
        expect(mockExtract).not.toHaveBeenCalled();
    });
});
