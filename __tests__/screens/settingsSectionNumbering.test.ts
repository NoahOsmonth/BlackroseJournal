/**
 * Settings numbers its sections 01..N down the page, and `index` also picks the
 * alternating band tone. Two sectsions sharing an index (or a gap) breaks both.
 *
 * This shipped: Reminders carried `index={2}` while Writing style already used
 * 2, so the list read 01, 02, 03, 03, 03, 05, 06, 07 - two rows numbered "03",
 * no "04", and three equal band tones in a row.
 *
 * Break this suite by: changing any `index={n}` in the screen.
 */
import fs from 'fs';
import path from 'path';

import { relPosix } from '../../__tests__/mocks/repoPath';

const SCREEN = 'app/(tabs)/settings.tsx';

function screenSource(): string {
    return fs.readFileSync(path.join(process.cwd(), SCREEN), 'utf8');
}

/** `index={n}` values in render order. */
function sectionIndices(source: string): number[] {
    return [...source.matchAll(/index=\{(\d+)\}/g)].map((match) => Number(match[1]));
}

describe('settings section numbering', () => {
    it('numbers sections 0..N-1 with no repeats and no gaps', () => {
        const indices = sectionIndices(screenSource());

        expect(indices.length).toBeGreaterThan(0);
        expect(indices).toEqual(indices.map((_, position) => position));
    });

    it('finds the screen through a repo-relative path on any OS', () => {
        // Guards the guard: a silently empty match list would pass the first
        // test vacuously on a machine where the path resolves differently.
        expect(relPosix(process.cwd(), path.join(process.cwd(), SCREEN))).toBe(SCREEN);
    });
});
