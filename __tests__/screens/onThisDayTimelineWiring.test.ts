import fs from 'fs';
import path from 'path';

import { relPosix } from '../mocks/repoPath';

const root = path.resolve(__dirname, '..', '..');
const read = (file: string): string => fs.readFileSync(path.join(root, relPosix(root, path.join(root, file))), 'utf8');

describe('On This Day full-view wiring', () => {
    const screen = read('app/on-this-day.tsx');
    const layout = read('app/_layout.tsx');
    const today = read('app/(tabs)/today.tsx');
    const insights = read('app/(tabs)/insights.tsx');
    const row = read('components/today/OnThisDayRow.tsx');
    const hook = read('hooks/today/useOnThisDayTimeline.ts');
    const util = read('utils/onThisDayTimeline.ts');
    const oldUtil = read('utils/onThisDay.ts');
    const oldHook = read('hooks/today/useOnThisDay.ts');

    it('registers the route in the root stack', () => {
        expect(layout).toContain('name="on-this-day"');
    });

    it('has TWO entry points and keeps the original one-memory row', () => {
        expect(today).toContain("onSeeAll={() => router.push('/on-this-day')}");
        expect(insights).toContain("router.push('/on-this-day')");
        expect(row).toContain('onSeeAll?: () => void');
        expect(row).toContain('testID="see-on-this-day"');
        expect(row).toContain('testID="today-on-this-day"');
        // Today's existing single memory must still open its detail.
        expect(today).toContain("pathname: '/entry-detail'");
        expect(oldUtil).toContain('pickOnThisDay');
        expect(oldHook).toContain('pickOnThisDay(items)');
    });

    it('screen reads through the hook, not a service or storage', () => {
        expect(screen).toContain('useOnThisDayTimeline(dateKey)');
        expect(screen).not.toContain('buildOnThisDayTimeline(');
        expect(screen).not.toContain('AsyncStorage');
        expect(screen).not.toContain('listEntries(');
    });

    it('hook reuses already-loaded collections with one memo each', () => {
        expect(hook).toContain('useJournalEntries()');
        expect(hook).toContain('useIntentionCheckIns()');
        expect(hook).toContain('buildHistoryItems(entries, checkIns)');
        expect(hook).toContain('buildOnThisDayTimeline(items, dateKeyToDate(dateKey))');
        expect(hook).not.toContain('AsyncStorage');
    });

    it('every past year is kept, newest first, and the util stays pure', () => {
        expect(util).toContain('.sort((a, b) => b[0] - a[0])');
        expect(util).toContain('year >= currentYear');
        expect(util).toContain('stepOnThisDayDate');
        expect(util).not.toContain('AsyncStorage');
        expect(util).not.toContain('useMemo');
        expect(util).not.toContain('Date.now()');
    });

    it('renders 44px controls, prev/next stepping and a back control', () => {
        expect(screen).toContain('min-h-11');
        expect(screen).toContain('testID="on-this-day-prev"');
        expect(screen).toContain('testID="on-this-day-next"');
        expect(screen).toContain('testID="on-this-day-back"');
        expect(screen).toContain('stepDate(key, delta)');
    });

    it('opens journal and check-in details from a tapped memory', () => {
        expect(screen).toContain("pathname: isCheckIn ? '/checkin-detail' : '/entry-detail'");
        expect(screen).toContain('params: { id: entry.sourceId }');
        expect(screen).toContain('testID={`on-this-day-memory-${entry.id}`}');
    });

    it('uses plain copy with both schemes and no space-* utilities', () => {
        expect(screen).toContain('On this day');
        expect(screen).toContain('Nothing here yet');
        expect(screen).toContain('memories from past years');
        expect(screen).toContain('dark:text-');
        expect(screen).not.toContain('space-y-');
        expect(screen).not.toContain('space-x-');
        expect(screen.split('\n').length).toBeLessThanOrEqual(500);
    });

    it('no new storage key and portable repo paths', () => {
        expect(util).not.toContain('@blackrose_');
        expect(hook).not.toContain('@blackrose_');
        expect(relPosix(root, path.join(root, 'app/on-this-day.tsx'))).toBe('app/on-this-day.tsx');
    });
});
