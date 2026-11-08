/**
 * The presence tile is fed by the Insights screen, and the bug lived in that
 * wiring: the screen passed the COMBINED entry + check-in count into a prop
 * labelled "Entries". A component test renders the tile directly and cannot
 * see that, so this file guards the call site in app/(tabs)/insights.tsx.
 *
 * Break this suite by: passing weeklyStats.entriesCount into `entries` again,
 * or dropping the `checkIns` prop.
 */
import fs from 'fs';
import path from 'path';
import { relPosix } from '../mocks/repoPath';

const repoRoot = path.resolve(__dirname, '../..');
const screenPath = path.join(repoRoot, 'app', '(tabs)', 'insights.tsx');

function readScreen(): string {
    return fs.readFileSync(screenPath, 'utf8');
}

describe('Insights screen feeds the writing tile honestly', () => {
    it('passes the journal-only count, not the combined one', () => {
        const source = readScreen();

        expect(source).toContain('entries={weeklyStats.journalCount}');
        expect(source).not.toContain('entries={weeklyStats.entriesCount}');
    });

    it('passes the check-in count so the tile can name it', () => {
        expect(readScreen()).toContain('checkIns={weeklyStats.checkInCount}');
    });

    it('still uses the combined count for the unlock threshold', () => {
        // The weekly report unlocks on total writing activity, so that gate
        // keeps entriesCount on purpose - only the tile label changed.
        expect(readScreen()).toContain('weeklyStats.entriesCount >= INSIGHTS_UNLOCK_AT');
    });

    it('scans the real screen file', () => {
        expect(relPosix(repoRoot, screenPath)).toBe('app/(tabs)/insights.tsx');
        expect(readScreen().length).toBeGreaterThan(1000);
    });
});
