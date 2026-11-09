import fs from 'fs';
import path from 'path';

import { relPosix } from '../mocks/repoPath';

/**
 * Round 55 measured every pressable on the main routes in a real browser and
 * found three inline text chips whose tap area was far under the 44px minimum:
 * the memory ledger's tag chips (12px tall + hitSlop 4 = 20px) and the theme
 * drift strip's themes (~24px + hitSlop 6 = 36px). Both are text inside a
 * wrapping row, so the fix is a 44px block around the label rather than a
 * bigger visual chip.
 *
 * A DOM probe cannot see this class of bug: hitSlop widens the touch area
 * without changing the element's rect, so a measurement alone cannot tell a
 * 20px target from a 44px one. That is why the guard is on the source.
 */
const ROOT = path.resolve(__dirname, '..', '..');

function read(rel: string): string {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/**
 * Every <Pressable ...> opening tag in a file. The arrow functions inside the
 * attributes contain '>' too, so those pairs are consumed first - a plain
 * [^>]* stops at the first '=>' and silently returns a truncated tag.
 */
function pressableTags(source: string): string[] {
    return source.match(/<Pressable\b(?:(?:=>)|[^>])*>/gs) ?? [];
}

describe('inline chip tap targets reach 44px (Kaneo #96)', () => {
    it('the memory ledger tag chips get a 44px block', () => {
        const tags = pressableTags(read('components/memory/MemoryLedgerRow.tsx'))
            .filter((tag) => tag.includes('Filter memory by'));
        expect(tags).toHaveLength(1);
        expect(tags[0]).toContain('min-h-11');
        expect(tags[0]).toMatch(/hitSlop=\{8\}/);
    });

    it('the theme drift strip themes get a 44px block', () => {
        const tags = pressableTags(read('components/memory/ThemeDriftStrip.tsx'))
            .filter((tag) => tag.includes('Filter memory by'));
        expect(tags).toHaveLength(1);
        expect(tags[0]).toContain('min-h-11');
        expect(tags[0]).toMatch(/hitSlop=\{8\}/);
    });

    it('the dock tabs keep a wide enough slop to clear 44px', () => {
        const source = read('components/journal/BottomNav.tsx');
        const slops = [...source.matchAll(/hitSlop=\{(\d+)\}/g)].map((m) => Number(m[1]));
        expect(slops.length).toBeGreaterThan(0);
        for (const slop of slops) {
            // The narrowest dock tab measures 31px; 31 + 2*slop must clear 44.
            expect(slop).toBeGreaterThanOrEqual(7);
        }
    });

    it('the memory map link and the goals overflow row are 44px tall', () => {
        const mapTags = pressableTags(read('components/memory/MemoryHubScreen.tsx'))
            .filter((tag) => tag.includes('Open the memory map'));
        expect(mapTags).toHaveLength(1);
        expect(mapTags[0]).toContain('min-h-11');

        const goalTags = pressableTags(read('components/today/GoalsSection.tsx'))
            .filter((tag) => tag.includes('more ${overflow === 1'));
        expect(goalTags).toHaveLength(1);
        expect(goalTags[0]).toContain('min-h-11');
    });

    it('no inline text chip is left with a slop too small to reach 44px', () => {
        // A chip that renders ~12px of text needs 16px of slop to reach 44.
        const offenders: string[] = [];
        for (const rel of ['components/memory/MemoryLedgerRow.tsx', 'components/memory/ThemeDriftStrip.tsx']) {
            const source = read(rel);
            for (const tag of pressableTags(source)) {
                if (!tag.includes('Filter memory by')) continue;
                if (!tag.includes('min-h-11')) offenders.push(relPosix(ROOT, path.join(ROOT, rel)));
            }
        }
        expect(offenders).toEqual([]);
    });
});
