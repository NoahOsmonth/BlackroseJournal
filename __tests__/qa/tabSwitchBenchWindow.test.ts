import fs from 'fs';
import path from 'path';

import { relPosix } from '../mocks/repoPath';

/**
 * Guard for the run-32 measurement mistake (corrected in run 39).
 *
 * A hand-written probe booted straight to /entries, waited 8 s, then pressed
 * Today with a synthetic pointer sequence and reported "84 reads / 4 journal
 * loads per tab switch". That number was the COLD-BOOT burst (11 index reads +
 * 160 shard reads in the first ~430 ms because all four tab screens mount at
 * once, plus seed and rollup work). A real dock switch in steady state does
 * exactly ONE journal load: 1 index + 16 shards = 20 reads.
 *
 * Two things in tab-switch-bench.mjs keep its number honest, and removing
 * either one silently reintroduces the false 4x claim:
 *
 *   1. `startSampling` zeroes the storage counters at the start of the window.
 *   2. The source tab is pressed and settles for 1500 ms BEFORE that reset, so
 *      boot-time reads are outside the window entirely.
 *
 * This test does not measure the app; it guards the measuring tool.
 */
const root = path.resolve(__dirname, '..', '..');
const read = (file: string): string => fs.readFileSync(path.join(root, file), 'utf8');

describe('tab-switch bench excludes cold-boot reads', () => {
    const bench = read('scripts/qa/tab-switch-bench.mjs');
    const instrument = read('scripts/qa/bench-instrument.mjs');

    it('resets the storage counters when the sampling window opens', () => {
        const start = instrument.slice(instrument.indexOf('export function startSampling'));
        expect(start).toMatch(/storage\.get = 0/);
        expect(start).toMatch(/storage\.set = 0/);
        expect(start).toMatch(/storage\.keys = \{\}/);
    });

    it('parks on the source tab before sampling, so the boot burst is outside', () => {
        const park = /pressDockTab\(page, TABS\[from\]\);\s*\n\s*await page\.waitForTimeout\((\d+)\);\s*\n\s*await page\.evaluate\(startSampling\);/;
        const match = bench.match(park);
        expect(match).not.toBeNull();
        expect(Number(match?.[1])).toBeGreaterThanOrEqual(1000);
    });

    it('resolves bench sources through a repo-relative path on any OS', () => {
        expect(relPosix(root, path.join(root, 'scripts/qa/tab-switch-bench.mjs')))
            .toBe('scripts/qa/tab-switch-bench.mjs');
    });
});
