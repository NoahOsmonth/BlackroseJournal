import fs from 'fs';
import path from 'path';

import { relPosix } from '../mocks/repoPath';

/**
 * Wiring guard for the writing-year feature. The screen needs many mocks to
 * render in Jest, so a link or route that disappears would otherwise go
 * unnoticed. Scan the real source instead.
 */
const root = path.resolve(__dirname, '..', '..');
const read = (file: string): string => fs.readFileSync(path.join(root, file), 'utf8');

describe('writing-year feature wiring', () => {
    const screen = read(relPosix(root, path.join(root, 'app/writing-year.tsx')));
    const layout = read(relPosix(root, path.join(root, 'app/_layout.tsx')));
    const streak = read(relPosix(root, path.join(root, 'app/streak-view.tsx')));
    const hook = read(relPosix(root, path.join(root, 'hooks/insights/useWritingYear.ts')));
    const util = read(relPosix(root, path.join(root, 'utils/writingYear.ts')));

    it('registers the route in the root stack', () => {
        expect(layout).toContain('name="writing-year"');
    });

    it('links from Streak with a plain-language label', () => {
        expect(streak).toContain("router.push('/writing-year')");
        expect(streak).toContain('See a year of writing');
        expect(streak).toContain('see-writing-year');
    });

    it('the screen reads the grid through the hook, not a service directly', () => {
        expect(screen).toContain('useWritingYear()');
        expect(screen).not.toContain('buildWritingYearGrid(');
        expect(screen).not.toContain('listEntries(');
    });

    it('the hook calls the pure builder and reads the already-loaded collections', () => {
        expect(hook).toContain('buildWritingYearGrid(words, new Date())');
        expect(hook).toContain('useJournalEntries()');
        expect(hook).toContain('useIntentionCheckIns()');
    });

    it('the util is pure: no I/O, no hooks, no clock inside the builder', () => {
        expect(util).not.toContain('AsyncStorage');
        expect(util).not.toContain('useState');
        expect(util).not.toContain('Date.now()');
        expect(util).toContain('endDate: Date');
    });

    it('every tone step has a light and a dark token in the config', () => {
        const config = read(relPosix(root, path.join(root, 'tailwind.config.js')));
        for (let level = 0; level <= 4; level += 1) {
            expect(config).toContain("'year-" + level + "-light'");
            expect(config).toContain("'year-" + level + "-dark'");
        }
        expect(config).toContain("'starred-gold-dark'");
    });

    it('keeps squares at a readable fixed size in a horizontal scroller', () => {
        // Regression: round 35 squeezed 53 columns into a 448px column, so
        // every square measured 4x4 px live and could not be seen or tapped.
        expect(screen).toContain('const CELL = 14;');
        expect(screen).toContain('const GRID_WIDTH = 53 * STEP - GAP;');
        expect(screen).toContain('writing-year-grid-scroll');
        expect(screen).toContain('style={{ width: CELL, height: CELL }}');
        expect(screen).not.toContain('aspect-square w-full');
    });

    it('puts month labels on the same column origin as the squares', () => {
        expect(screen).toContain('style={{ left: month.weekIndex * STEP }}');
        expect(screen).not.toContain('(month.weekIndex / grid.weeksCount) * 100');
    });

    it('choosing a day reads it from the hook map, not another read', () => {
        // Round 70 (#111): the 14px squares stopped being buttons - a fingertip is
        // wider than three cells - so the day is chosen with the 44px stepper. The
        // invariant that matters survives: the day comes from daysByKey, never a
        // second storage read.
        expect(screen).toContain('daysByKey');
        expect(screen).toContain('setSelectedDay(clampDayKey(shiftDayKey(');
        expect(screen).not.toContain('setSelectedDay(day.dateKey)');
        expect(screen).toContain('writing-day-item-');
        expect(screen).toContain("pathname: item.kind === 'entry' ? '/entry-detail' : '/checkin-detail'");
        // Round 43: day rows moved to one shared pure builder for both grids.
        expect(hook).toContain('buildWritingDayRows(entries, checkIns)');
        expect(hook).not.toContain('listEntries(');
        const shared = read(relPosix(root, path.join(root, 'utils/writingDayRows.ts')));
        expect(shared).toContain('groupWritingByDay(rows)');
    });

    it('resolves source paths on any OS', () => {
        expect(relPosix(root, path.join(root, 'app/writing-year.tsx'))).toBe('app/writing-year.tsx');
        expect(relPosix(root, path.join(root, 'app/streak-view.tsx'))).toBe('app/streak-view.tsx');
    });
});
