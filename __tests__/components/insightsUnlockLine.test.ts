/**
 * Run 31 fixed the Writing stats tile, which counted check-ins as entries. Its
 * sibling kept the same lie: directly above a tile reading "1 Entry + 2
 * check-ins", the weekly-report gate said "Unlocks with 2 more entries".
 *
 * The unlock threshold really is combined (an entry or a check-in both count as
 * writing), so the fix is in the copy, not the maths: say "moments of writing",
 * which stays true whichever the writer does next.
 *
 * Break this suite by: putting "more entries" back in unlockLine.
 */
import { unlockLine } from '../../components/insights/InsightsWeekLetter';

describe('unlockLine — never calls a check-in an entry', () => {
    it('does not say "entries" for the headline', () => {
        const line = unlockLine(2, 'Unlocks');

        expect(line).toBe('Unlocks with 2 more moments of writing');
        expect(line).not.toContain('entries');
        expect(line).not.toContain('entry');
    });

    it('does not say "entries" for the quiet line either', () => {
        const line = unlockLine(2, 'Requires');

        expect(line).toBe('Requires 2 more moments of writing');
        expect(line).not.toContain('entries');
    });

    it('reads naturally for a single remaining moment', () => {
        expect(unlockLine(1, 'Unlocks')).toBe('Unlocks with one more bit of writing');
        expect(unlockLine(1, 'Requires')).toBe('Requires one more bit of writing');
    });

    it('has no doubled or trailing spaces', () => {
        for (const verb of ['Unlocks', 'Requires'] as const) {
            const line = unlockLine(3, verb);
            expect(line).toBe(line.trim());
            expect(line).not.toMatch(/ {2,}/);
        }
    });
});
