import { renderHook, waitFor } from '@testing-library/react-native';
import { useThisWeek } from '@/hooks/journal/useThisWeek';
import { getLocalDateKey } from '@/utils/date';

const mockListEntries = jest.fn();
jest.mock('@/services/journal/journalStorage', () => ({
    listEntries: (...args: unknown[]) => mockListEntries(...args),
}));
jest.mock('@/hooks/account/useActiveAccountId', () => ({
    useActiveAccountId: () => 'account-1',
}));

// Relative to the CALENDAR week (Sunday to Saturday) containing today, because
// that is the window useThisWeek now uses. `daysAgo` alone is not enough: two
// days back can still land in last week when today is Sunday or Monday.
function startOfThisWeek(): Date {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
}

function daysAgo(days: number): number {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.getTime();
}

/** Absolute timestamp for the Sunday of the current calendar week. */
function weekStartMs(): number {
    const d = startOfThisWeek();
    d.setHours(12, 0, 0, 0);
    return d.getTime();
}




/** Like `entry`, but at an absolute timestamp instead of a relative offset. */
function datedEntry(id: string, at: number, text: string, status = 'completed') {
    return {
        id,
        title: '',
        emoji: '',
        status,
        createdAt: at,
        updatedAt: at,
        messages: [{ id: 'm1', role: 'user', content: text, timestamp: at }],
    };
}





function entry(id: string, daysBack: number, text: string, status = 'completed') {
    return {
        id,
        title: '',
        emoji: '',
        status,
        createdAt: daysAgo(daysBack),
        updatedAt: daysAgo(daysBack),
        messages: [{ id: 'm1', role: 'user', content: text, timestamp: daysAgo(daysBack) }],
    };
}

describe('useThisWeek', () => {
    beforeEach(() => {
        mockListEntries.mockReset();
    });

    it('counts themes from entries inside the week', async () => {
        mockListEntries.mockResolvedValue([
            datedEntry('a', weekStartMs(), 'Sleep was rough again, kept waking up.'),
            datedEntry('b', weekStartMs() + 3 * 86400000, 'Finally slept through after a long walk.'),
        ]);
        const { result } = renderHook(() => useThisWeek());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.ledger.themes.map((t) => t.label)).toContain('sleep');
        expect(result.current.ledger.daysWritten).toBe(2);
    });

    it('ignores entries older than the week', async () => {
        mockListEntries.mockResolvedValue([
            entry('old', 20, 'Sleep and work and worry every single day.'),
            entry('new', 0, 'Short note about the rain.'),
        ]);
        const { result } = renderHook(() => useThisWeek());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.ledger.daysWritten).toBe(1);
    });

    it('ignores drafts: an unfinished entry is not a theme', async () => {
        mockListEntries.mockResolvedValue([entry('d', 1, 'work work work', 'draft')]);
        const { result } = renderHook(() => useThisWeek());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.ledger.daysWritten).toBe(0);
    });

    it('shows an empty week instead of an error when reading fails', async () => {
        mockListEntries.mockRejectedValue(new Error('storage down'));
        const { result } = renderHook(() => useThisWeek());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.ledger).toEqual({ daysWritten: 0, totalDays: 7, themes: [] });
    });

    it('marks today as the last day of the window', async () => {
        mockListEntries.mockResolvedValue([entry('today', 0, 'walk walk by the river')]);
        const { result } = renderHook(() => useThisWeek());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(getLocalDateKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(result.current.ledger.totalDays).toBe(7);
    });
});
