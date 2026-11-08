import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useLetters } from '@/hooks/letters/useLetters';

const mockList = jest.fn();
const mockCreate = jest.fn();
const mockDelete = jest.fn();

jest.mock('@/services/letters/lettersStorage', () => ({
    listLetters: (...a: unknown[]) => mockList(...a),
    createLetter: (...a: unknown[]) => mockCreate(...a),
    deleteLetter: (...a: unknown[]) => mockDelete(...a),
}));
jest.mock('@/hooks/account/useActiveAccountId', () => ({ useActiveAccountId: () => 'account-1' }));

function row(overrides: Record<string, unknown> = {}) {
    return {
        id: 'l1',
        body: 'secret words',
        unlockDate: '2099-01-01',
        writtenDate: '2026-11-08',
        createdAt: 1,
        ...overrides,
    };
}

describe('useLetters', () => {
    beforeEach(() => {
        mockList.mockReset();
        mockCreate.mockReset();
        mockDelete.mockReset();
    });

    it('hides the words of a sealed letter', async () => {
        mockList.mockResolvedValue([row()]);
        const { result } = renderHook(() => useLetters());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.letters[0].isUnlocked).toBe(false);
        expect(result.current.letters[0].body).toBeUndefined();
    });

    it('shows the words of a letter whose day has come', async () => {
        mockList.mockResolvedValue([row({ unlockDate: '2000-01-01' })]);
        const { result } = renderHook(() => useLetters());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.letters[0].body).toBe('secret words');
    });

    it('seals a letter and refreshes the list', async () => {
        mockList.mockResolvedValue([]);
        mockCreate.mockResolvedValue(row());
        const { result } = renderHook(() => useLetters());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        mockList.mockResolvedValue([row()]);
        let ok = false;
        await act(async () => { ok = await result.current.seal('hello', '2099-01-01'); });
        expect(ok).toBe(true);
        expect(mockCreate).toHaveBeenCalledWith({ body: 'hello', unlockDate: '2099-01-01' });
        expect(result.current.letters).toHaveLength(1);
    });

    it('says so in plain words when saving fails', async () => {
        mockList.mockResolvedValue([]);
        mockCreate.mockRejectedValue(new Error('disk'));
        const { result } = renderHook(() => useLetters());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        let ok = true;
        await act(async () => { ok = await result.current.seal('hello', '2099-01-01'); });
        expect(ok).toBe(false);
        expect(result.current.error).toMatch(/could not be saved/i);
    });

    it('shows an empty list instead of crashing when reading fails', async () => {
        mockList.mockRejectedValue(new Error('disk'));
        const { result } = renderHook(() => useLetters());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.letters).toEqual([]);
        expect(result.current.error).toMatch(/Could not open your letters/i);
    });
});
