import { fireEvent, render } from '@testing-library/react-native';
import { ThisWeek } from '@/components/insights/ThisWeek';
import type { WeekLedger } from '@/utils/thisWeek';

function ledger(overrides: Partial<WeekLedger> = {}): WeekLedger {
    return { daysWritten: 4, totalDays: 7, themes: [], ...overrides };
}

describe('ThisWeek', () => {
    it('lists the words that kept coming back', () => {
        const { getByText } = render(
            <ThisWeek
                ledger={ledger({ themes: [{ label: 'sleep', days: 3, mentions: 5 }] })}
                onOpenWeek={jest.fn()}
            />,
        );
        expect(getByText('What kept coming back')).toBeTruthy();
        expect(getByText('sleep')).toBeTruthy();
        expect(getByText('on 3 days')).toBeTruthy();
    });

    it('says two days in plain words', () => {
        const { getByText } = render(
            <ThisWeek ledger={ledger({ themes: [{ label: 'walk', days: 2, mentions: 2 }] })} onOpenWeek={jest.fn()} />,
        );
        expect(getByText('on 2 days')).toBeTruthy();
    });

    it('stays out of the way when there is nothing to compare', () => {
        const { queryByText } = render(
            <ThisWeek ledger={ledger({ daysWritten: 1, themes: [] })} onOpenWeek={jest.fn()} />,
        );
        expect(queryByText('What kept coming back')).toBeNull();
    });

    it('invites writing when the week is empty', () => {
        const { getByText } = render(
            <ThisWeek ledger={ledger({ daysWritten: 0, themes: [] })} onOpenWeek={jest.fn()} />,
        );
        expect(getByText(/Nothing written this week yet/)).toBeTruthy();
    });

    it('explains a quiet week without sounding like a failure', () => {
        const { getByText } = render(
            <ThisWeek ledger={ledger({ daysWritten: 4, themes: [] })} onOpenWeek={jest.fn()} />,
        );
        expect(getByText(/No word came up twice yet/)).toBeTruthy();
    });

    it('opens the week entries when tapped', () => {
        const onOpenWeek = jest.fn();
        const { getByLabelText } = render(
            <ThisWeek ledger={ledger()} onOpenWeek={onOpenWeek} />,
        );
        fireEvent.press(getByLabelText('See this week\u2019s entries'));
        expect(onOpenWeek).toHaveBeenCalledTimes(1);
    });

    it('paints every line for light and dark', () => {
        // Rule 1: a bare text token is invisible in the other scheme, and RN text
        // does not inherit colour from its parent View.
        const { getByText, getByLabelText } = render(
            <ThisWeek ledger={ledger({ themes: [{ label: 'work', days: 3, mentions: 4 }] })} onOpenWeek={jest.fn()} />,
        );
        const lines = [
            getByText('This week'),
            getByText('What kept coming back'),
            getByText('work'),
            getByText('on 3 days'),
            getByLabelText('See this week\u2019s entries'),
        ];
        for (const line of lines) {
            const className = String(line.props.className ?? '');
            expect(className).toMatch(/dark:/);
        }
        const card = String(getByLabelText('What kept coming back this week').props.className ?? '');
        expect(card).toContain('bg-surface-light');
        expect(card).toContain('dark:bg-surface-dark');
    });

    it('uses no technical words', () => {
        const { toJSON } = render(
            <ThisWeek ledger={ledger({ themes: [{ label: 'work', days: 4, mentions: 6 }] })} onOpenWeek={jest.fn()} />,
        );
        const text = JSON.stringify(toJSON());
        // Whole words only: "capitalize" in a class name must not read as "api".
        ['token', 'model', 'provider', 'digest', 'atom', 'insight'].forEach((word) => {
            expect(text.toLowerCase()).not.toContain(word);
        });
    });
});
