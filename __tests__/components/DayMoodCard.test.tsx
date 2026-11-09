/**
 * The card against the real store, not a mocked hook: the whole point is that
 * the writer's own days turn into a sentence, and only when the counts allow it.
 */
import { render, screen, waitFor } from '@testing-library/react-native';

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
