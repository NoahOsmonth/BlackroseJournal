import fs from 'fs';
import path from 'path';

import { relPosix } from '../mocks/repoPath';

/** Source-scan guard: the screen has too many mocks to render in Jest. */
const root = path.resolve(__dirname, '..', '..');
const read = (file: string): string => fs.readFileSync(path.join(root, file), 'utf8');

describe('month calendar day-tap wiring', () => {
    const screen = read(relPosix(root, path.join(root, 'app/monthly-review.tsx')));
    const panel = read(relPosix(root, path.join(root, 'components/insights/MonthlyDayPanel.tsx')));
    const hook = read(relPosix(root, path.join(root, 'hooks/insights/useMonthlyReview.ts')));
    const yearHook = read(relPosix(root, path.join(root, 'hooks/insights/useWritingYear.ts')));
    const builder = read(relPosix(root, path.join(root, 'utils/writingDayRows.ts')));

    it('day squares are pressable, not inert views', () => {
        expect(screen).toContain('onPress={() => { if (day.dateKey) setSelectedDay(day.dateKey); }}');
        expect(screen).toContain('accessibilityRole="button"');
        // 36px squares with hitSlop 4 give an effective 44px touch target.
        expect(screen).toContain('hitSlop={4}');
        expect(screen).toContain('const CELL = 36;');
        expect(screen).toContain('style={{ width: CELL, height: CELL }}');
        expect(screen).toContain('monthly-day-');
    });

    it('selection comes from the hook map, with no extra read', () => {
        expect(screen).toContain('const { review, daysByKey, isLoading } = useMonthlyReview');
        expect(screen).toContain('daysByKey.get(selectedDay)');
        expect(hook).toContain('buildWritingDayRows(entries, checkIns)');
        expect(hook).not.toContain('listEntries(');
        expect(hook).toContain('buildMonthlyReview(records, year, month, new Date())');
        expect(hook.match(/useMemo\(/g)).toHaveLength(1);
    });

    it('changing month clears a stale day selection', () => {
        const move = screen.slice(screen.indexOf('const move ='), screen.indexOf('const selected ='));
        expect(move).toContain('setSelectedDay(null)');
        expect(move).toContain('shiftMonth(p.year, p.month, delta)');
    });

    it('the panel shows that day and opens the right detail route', () => {
        expect(screen).toContain('<MonthlyDayPanel dateKey={selectedDay} day={selected} />');
        expect(panel).toContain('monthly-day-panel');
        expect(panel).toContain('formatWritingDay(dateKey)');
        expect(panel).toContain("pathname: item.kind === 'entry' ? '/entry-detail' : '/checkin-detail'");
        expect(panel).toContain('params: { id: item.id }');
        expect(panel).toContain('monthly-day-item-');
        expect(panel).toContain('Nothing written on this day.');
        expect(panel).toContain('min-h-11');
    });

    it('plain language and both schemes, no dropped spacing utilities', () => {
        expect(screen).toContain('Tap a day to read it.');
        expect(panel).not.toContain('space-y-');
        expect(panel).not.toContain('space-x-');
        expect(panel).toContain('dark:bg-surface-dark');
        expect(panel).toContain('dark:text-text-dark');
        expect(panel).toContain('dark:text-text-secondary-dark');
        expect(panel).toContain('dark:border-hairline-dark');
    });

    it('one shared pure builder backs both the month and the year', () => {
        expect(yearHook).toContain('buildWritingDayRows(entries, checkIns)');
        expect(yearHook).not.toContain('buildEntryText(');
        expect(builder).not.toContain('AsyncStorage');
        expect(builder).not.toContain('useState');
        expect(builder).not.toContain('Date.now()');
        expect(builder).toContain('groupWritingByDay(rows)');
    });

    it('keeps the screen under the 500-line design limit', () => {
        expect(screen.split(/\r?\n/).length).toBeLessThanOrEqual(500);
        expect(panel.split(/\r?\n/).length).toBeLessThanOrEqual(500);
    });

    it('resolves source paths on any OS', () => {
        expect(relPosix(root, path.join(root, 'app/monthly-review.tsx'))).toBe('app/monthly-review.tsx');
        expect(relPosix(root, path.join(root, 'components/insights/MonthlyDayPanel.tsx'))).toBe('components/insights/MonthlyDayPanel.tsx');
    });
});
