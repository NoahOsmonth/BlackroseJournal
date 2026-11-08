import fs from 'fs';
import path from 'path';

import { relPosix } from '../mocks/repoPath';

/**
 * Wiring guard for the month-in-review feature. The screen needs many mocks
 * to render in Jest, so scan the real source instead.
 */
const root = path.resolve(__dirname, '..', '..');
const read = (file: string): string => fs.readFileSync(path.join(root, file), 'utf8');

describe('month-in-review feature wiring', () => {
    const screen = read(relPosix(root, path.join(root, 'app/monthly-review.tsx')));
    const layout = read(relPosix(root, path.join(root, 'app/_layout.tsx')));
    const insights = read(relPosix(root, path.join(root, 'app/(tabs)/insights.tsx')));
    const hook = read(relPosix(root, path.join(root, 'hooks/insights/useMonthlyReview.ts')));
    const util = read(relPosix(root, path.join(root, 'utils/monthlyReview.ts')));

    it('registers the route in the root stack', () => {
        expect(layout).toContain('name="monthly-review"');
    });

    it('links from Insights with plain language', () => {
        expect(insights).toContain("router.push('/monthly-review')");
        expect(insights).toContain('See a month in review');
        expect(insights).toContain('see-monthly-review');
    });

    it('the screen reads the review through the hook, not a service directly', () => {
        expect(screen).toContain('useMonthlyReview(period.year, period.month)');
        expect(screen).not.toContain('buildMonthlyReview(');
        expect(screen).not.toContain('listEntries(');
    });

    it('the hook uses the already-loaded collections, no extra reads', () => {
        expect(hook).toContain('useJournalEntries()');
        expect(hook).toContain('useIntentionCheckIns()');
        expect(hook).not.toContain('listEntries(');
        expect(hook).toContain('buildMonthlyReview(records, year, month, new Date())');
    });

    it('the util is pure: no I/O, no hooks, no clock read', () => {
        expect(util).not.toContain('AsyncStorage');
        expect(util).not.toContain('useState');
        expect(util).not.toContain('Date.now()');
        expect(util).toContain('today: Date');
    });

    it('keeps calendar cells at a readable fixed size', () => {
        // Round 36 lesson: 4x4 px squares shipped because nobody measured.
        expect(screen).toContain('const CELL = 36;');
        expect(screen).toContain('style={{ width: CELL, height: CELL }}');
        expect(screen).toContain('monthly-calendar');
    });

    it('puts weekday labels on the same fixed columns as the day cells', () => {
        // Round 37 zoom-in QA: flex-1 headers measured 55px while the day cells
        // were 36px at a 40px pitch, so labels drifted off their columns.
        const header = screen.slice(screen.indexOf('WEEKDAYS.map'), screen.indexOf('review.calendar.map'));
        expect(header).toContain('style={{ width: CELL }}');
        expect(header).not.toContain('flex-1');
        expect(header).toContain('gap-[4px]');
    });

    it('offers previous and next month controls', () => {
        expect(screen).toContain('monthly-prev');
        expect(screen).toContain('monthly-next');
        expect(screen).toContain('shiftMonth(p.year, p.month, delta)');
    });

    it('resolves source paths on any OS', () => {
        expect(relPosix(root, path.join(root, 'app/monthly-review.tsx'))).toBe('app/monthly-review.tsx');
        expect(relPosix(root, path.join(root, 'app/(tabs)/insights.tsx'))).toBe('app/(tabs)/insights.tsx');
    });
});
