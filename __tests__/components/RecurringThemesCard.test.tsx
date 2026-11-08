import React from 'react';
import { render } from '@testing-library/react-native';
import { RecurringThemesCard } from '@/components/today/RecurringThemesCard';

const base = { needsMoreWeeks: false, weekCount: 6, isUnavailable: false };

describe('RecurringThemesCard', () => {
    it('lists a theme with how many weeks it came back in', () => {
        const { getByText } = render(
            <RecurringThemesCard
                {...base}
                themes={[{ topic: 'work stress', weeks: ['2026-W40', '2026-W41', '2026-W42'], weekCount: 3, lastWeek: '2026-W42' }]}
            />,
        );
        expect(getByText('work stress')).toBeTruthy();
        expect(getByText('3 weeks')).toBeTruthy();
    });

    it('asks for more weeks when there are too few', () => {
        const { getByText } = render(<RecurringThemesCard {...base} themes={[]} needsMoreWeeks weekCount={2} />);
        expect(getByText(/Written 2 weeks so far/)).toBeTruthy();
    });

    it('never tells someone with no weeks to write more months', () => {
        const { getByText } = render(<RecurringThemesCard {...base} themes={[]} needsMoreWeeks weekCount={0} />);
        expect(getByText(/Write for a few more weeks/)).toBeTruthy();
    });

    it('says so plainly when there is no pattern yet', () => {
        const { getByText } = render(<RecurringThemesCard {...base} themes={[]} weekCount={8} />);
        expect(getByText(/Nothing has come back across weeks yet/)).toBeTruthy();
    });

    it('admits a read failure instead of pretending there is no pattern', () => {
        const { getByText, queryByText } = render(
            <RecurringThemesCard {...base} themes={[]} isUnavailable weekCount={0} />,
        );
        expect(getByText(/could not be opened just now/)).toBeTruthy();
        expect(queryByText(/Write for a few more weeks/)).toBeNull();
    });

    it('does not show the never-a-pattern line during a read failure', () => {
        const { queryByText } = render(<RecurringThemesCard {...base} themes={[]} isUnavailable weekCount={9} />);
        expect(queryByText(/Nothing has come back/)).toBeNull();
    });
});
