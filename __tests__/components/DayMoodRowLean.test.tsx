/**
 * The pattern line on Today (Kaneo #100).
 *
 * Today must not be more confident than Insights: same store, same rules, and
 * nothing at all when there is no lean to report.
 */
import { render, screen, waitFor } from '@testing-library/react-native';

import { DayMoodRow } from '@/components/today/DayMoodRow';
import type { AccountStorageAdapter } from '../../services/account/accountScopedStorage';
import { setAccountStorageAdapter } from '../../services/account/accountScopedStorage';
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

describe('the pattern line on Today', () => {
    beforeEach(async () => {
        await clearActiveAccount();
        setAccountStorageAdapter(memoryAdapter());
        await activateAccount('lean-account');
    });
    afterEach(async () => { await clearActiveAccount(); });

    it('says nothing on a fresh journal', async () => {
        render(<DayMoodRow />);
        await waitFor(() => expect(screen.getByTestId('day-mood-row')).toBeTruthy());
        expect(screen.queryByTestId('day-mood-lean-line')).toBeNull();
    });

    it('says nothing when the evidence is too thin', async () => {
        await seed(0, 'light', ['people']);
        await seed(1, 'heavy', ['work']);
        render(<DayMoodRow />);
        await waitFor(() => expect(screen.getByTestId('day-mood-row')).toBeTruthy());
        expect(screen.queryByTestId('day-mood-lean-line')).toBeNull();
    });

    it('shows the same sentence Insights would show', async () => {
        await seed(0, 'light', ['people']);
        await seed(1, 'calm', ['people']);
        await seed(2, 'light', ['people']);
        await seed(3, 'calm');
        await seed(4, 'heavy', ['work']);
        await seed(5, 'restless', ['work']);
        await seed(6, 'heavy');
        await seed(7, 'restless');
        render(<DayMoodRow />);
        await waitFor(() => expect(screen.getByTestId('day-mood-lean-line')).toBeTruthy());
        expect(screen.getByText('On 3 of your 4 lighter days, People was in the mix.')).toBeTruthy();
    });

    it('keeps the feeling chips even when the line is showing', async () => {
        await seed(0, 'light', ['people']);
        await seed(1, 'calm', ['people']);
        await seed(2, 'light', ['people']);
        await seed(3, 'calm');
        await seed(4, 'heavy', ['work']);
        await seed(5, 'restless', ['work']);
        await seed(6, 'heavy');
        await seed(7, 'restless');
        render(<DayMoodRow />);
        await waitFor(() => expect(screen.getByTestId('day-mood-lean-line')).toBeTruthy());
        // The question and its chips are still there - the line is additive.
        expect(screen.getByTestId('day-mood-light')).toBeTruthy();
        expect(screen.getByTestId('day-mood-restless')).toBeTruthy();
    });
});
