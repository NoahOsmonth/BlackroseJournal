/**
 * The card against the real store, not a mocked hook: the whole point is that
 * the writer's own days turn into a sentence, and only when the counts allow it.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DayMoodCard } from '@/components/insights/DayMoodCard';
import { setAccountStorageAdapter } from '../../services/account/accountScopedStorage';
import type { AccountStorageAdapter } from '../../services/account/accountScopedStorage';
import { activateAccount, clearActiveAccount } from '../../services/account/accountRuntime';
import { setDayMoodFeeling, toggleDayFactor } from '../../services/journal/dayMood';
import { getLocalDateKey } from '../../utils/date';

function memoryAdapter(): AccountStorageAdapter {
    const rows = new Map<string, string>();
    return {
        getItem: (k) => Promise.resolve(rows.get(k) ?? null),
        setItem: (k, v) => { rows.set(k, v); return Promise.resolve(); },
        removeItem: (k) => { rows.delete(k); return Promise.resolve(); },
    };
}

function keyDaysAgo(offset: number): string {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    return getLocalDateKey(date);
}

async function seed(offset: number, moodId: string, factors: string[] = []): Promise<void> {
    const key = keyDaysAgo(offset);
    await setDayMoodFeeling(key, moodId);
    for (const factor of factors) await toggleDayFactor(key, factor);
}

describe('DayMoodCard', () => {
    beforeEach(async () => {
        await clearActiveAccount();
        setAccountStorageAdapter(memoryAdapter());
        await activateAccount('insight-account');
    });
    afterEach(async () => { await clearActiveAccount(); });

    it('renders nothing when no day has been recorded', async () => {
        render(<DayMoodCard />);
        await waitFor(() => expect(screen.queryByTestId('day-mood-card')).toBeNull());
    });

    it('asks for a few more days instead of inventing a pattern', async () => {
        await seed(0, 'light', ['people']);
        await seed(1, 'heavy', ['work']);
        render(<DayMoodCard />);
        await waitFor(() => expect(screen.getByTestId('day-mood-card')).toBeTruthy());
        expect(screen.getByText('2 days so far. A pattern needs a few more.')).toBeTruthy();
        expect(screen.queryByTestId('day-mood-lean')).toBeNull();
    });

    it('names the cause that leans to the lighter side', async () => {
        await seed(0, 'light', ['people']);
        await seed(1, 'calm', ['people']);
        await seed(2, 'light', ['people']);
        await seed(3, 'calm');
        await seed(4, 'heavy', ['work']);
        await seed(5, 'restless', ['work']);
        await seed(6, 'heavy');
        await seed(7, 'restless');
        render(<DayMoodCard />);
        await waitFor(() => expect(screen.getByTestId('day-mood-lean')).toBeTruthy());
        expect(screen.getByText('On 3 of your 4 lighter days, People was in the mix.')).toBeTruthy();
        expect(screen.getByTestId('day-mood-lighter')).toBeTruthy();
    });

    it('says which stretch of time it is looking at', async () => {
        await seed(0, 'light', ['people']);
        render(<DayMoodCard />);
        await waitFor(() => expect(screen.getByTestId('day-mood-card')).toBeTruthy());
        expect(screen.getByTestId('day-mood-period').props.children).toEqual([
            'Looking at ',
            'the last four weeks',
        ]);
    });

    it('widens to three months without becoming more confident', async () => {
        // A pattern that only exists 40 days back: invisible at four weeks.
        await seed(40, 'light', ['movement']);
        await seed(41, 'light', ['movement']);
        await seed(42, 'light', ['movement']);
        await seed(43, 'calm');
        await seed(0, 'heavy', ['work']);
        await seed(1, 'heavy', ['work']);
        await seed(2, 'heavy', ['work']);
        await seed(3, 'restless');
        render(<DayMoodCard />);
        await waitFor(() => expect(screen.getByTestId('day-mood-card')).toBeTruthy());
        // Four weeks: only the recent heavy days exist, so no lean.
        expect(screen.queryByTestId('day-mood-lean')).toBeNull();

        fireEvent.press(screen.getByTestId('day-mood-lens-90'));
        await waitFor(() => expect(screen.getByTestId('day-mood-period').props.children).toEqual([
            'Looking at ',
            'the last three months',
        ]));
        // Three months: both sides now have four days, so the lean can be named.
        await waitFor(() => expect(screen.getByTestId('day-mood-lean')).toBeTruthy());
        expect(screen.getByTestId('day-mood-lighter').props.children).toBe('4 days: Movement');
    });

    it('draws the last thirty days, gaps included (Kaneo #104)', async () => {
        await seed(0, 'heavy');
        await seed(3, 'light');
        render(<DayMoodCard />);
        await waitFor(() => expect(screen.getByTestId('day-mood-strip')).toBeTruthy());

        const bars = screen.getAllByRole('image');
        expect(bars).toHaveLength(30);
        const labels = bars.map((bar) => bar.props.accessibilityLabel as string);
        // Oldest first, so the newest day is the last bar.
        expect(labels[labels.length - 1]).toMatch(/: Heavy$/);
        expect(labels[labels.length - 4]).toMatch(/: Light$/);
        expect(labels.filter((label) => label.endsWith('no entry'))).toHaveLength(28);
    });

    it('keeps the strip out of a card that has nothing to show', async () => {
        render(<DayMoodCard />);
        await waitFor(() => expect(screen.queryByTestId('day-mood-card')).toBeNull());
        expect(screen.queryByTestId('day-mood-strip')).toBeNull();
    });

    it('shows both sides in plain words', async () => {
        await seed(0, 'light', ['people']);
        await seed(1, 'heavy', ['work']);
        await seed(2, 'light');
        await seed(3, 'heavy');
        render(<DayMoodCard />);
        await waitFor(() => expect(screen.getByTestId('day-mood-lighter')).toBeTruthy());
        expect(screen.getByTestId('day-mood-lighter').props.children).toBe('2 days: People');
        expect(screen.getByTestId('day-mood-heavier').props.children).toBe('2 days: Work');
    });
});
