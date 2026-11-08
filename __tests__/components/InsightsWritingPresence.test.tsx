/**
 * A check-in is not an entry. The Writing stats tile used to print one number
 * labelled "Entries" covering journal entries + check-ins, so a week with one
 * entry and two check-ins read "3 Entries" - telling the writer they journaled
 * three times when they wrote once.
 *
 * Break this suite by: passing entriesCount back into <InsightsWritingPresence>
 * (the check-in case goes red), or by dropping the check-ins clause from
 * proseLine (the prose assertion goes red).
 */
import { render, screen } from '@testing-library/react-native';
import { InsightsWritingPresence } from '../../components/insights/InsightsWritingPresence';

const base = {
    words: 68,
    dailyWords: [0, 0, 68, 0, 0, 0, 0],
    maxWords: 68,
};

describe('InsightsWritingPresence — entries vs check-ins', () => {
    it('names check-ins instead of folding them into the entry count', () => {
        render(<InsightsWritingPresence {...base} entries={1} checkIns={2} />);

        // The label renders as two adjacent expressions in one Text; assert on
        // the joined string so the test does not care how RN splits children.
        expect(screen.getByText('Entry + 2 check-ins')).toBeTruthy();
        // The old lie: three things shown as three "entries".
        expect(screen.queryByText('Entries')).toBeNull();
    });

    it('says entry and check-in in the summary line', () => {
        render(<InsightsWritingPresence {...base} entries={1} checkIns={2} />);

        // The prose line lives in accessibilityLabel rather than a Text node.
        expect(screen.getByLabelText(/1 entry · 2 check-ins · 1 day/)).toBeTruthy();
    });

    it('keeps a plain entry count when there are no check-ins', () => {
        render(<InsightsWritingPresence {...base} entries={3} checkIns={0} />);

        expect(screen.getByText('Entries')).toBeTruthy();
        expect(screen.queryByText(/check-in/)).toBeNull();
        expect(screen.getByLabelText(/3 entries · 1 day/)).toBeTruthy();
    });

    it('still says nothing was written when the week is empty', () => {
        render(
            <InsightsWritingPresence
                words={0}
                entries={0}
                checkIns={0}
                dailyWords={[0, 0, 0, 0, 0, 0, 0]}
                maxWords={0}
            />,
        );

        expect(screen.getByLabelText('No writing yet this week')).toBeTruthy();
    });

    it('uses the singular for a single check-in', () => {
        render(<InsightsWritingPresence {...base} entries={0} checkIns={1} />);

        expect(screen.getByText('Entries + 1 check-in')).toBeTruthy();
    });
});
