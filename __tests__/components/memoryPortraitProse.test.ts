/**
 * The portrait summary used to read "33 memories · 99 themes · 4 notes".
 * Two lies in one line:
 *
 *   1. "themes" was a call to topMemoryThemes(atoms, 99) — the count of
 *      distinct TAGS, silently truncated at 99. The real store had 130.
 *   2. Calling a tag a theme told the writer their 33 memories contained 99
 *      recurring subjects.
 *
 * Break this suite by: restoring the 99 cap, or relabelling back to "themes".
 */
import {
    memoryPortraitProse,
    topMemoryThemes,
} from '../../components/memory/memoryDisplay';

import type { LocalMemoryAtom } from '../../services/memory/localMemory.types';

function atom(
    tags: string[],
    layer: LocalMemoryAtom['layer'] = 'semantic',
): LocalMemoryAtom {
    return {
        id: `a${tags.join('-')}`,
        source: 'journal',
        title: 't',
        content: 'c',
        tags,
        layer,
        salience: 0.5,
        confidence: 0.5,
        createdAt: 1,
        updatedAt: 1,
        accessCount: 0,
    };
}

describe('memoryPortraitProse — keyword counts are not truncated', () => {
    it('reports every distinct tag instead of stopping at 99', () => {
        // 120 tags spread over 4 memories - past the old cap.
        const tags = Array.from({ length: 120 }, (_, i) => `tag${i}`);
        const atoms = [
            atom(tags.slice(0, 30)),
            atom(tags.slice(30, 60)),
            atom(tags.slice(60, 90)),
            atom(tags.slice(90)),
        ];

        expect(topMemoryThemes(atoms, 99)).toHaveLength(99);
        expect(memoryPortraitProse(atoms)).toContain('120 keywords');
    });

    it('calls them keywords, never themes', () => {
        const atoms = [atom(['calm']), atom(['calm', 'work'])];

        const prose = memoryPortraitProse(atoms);
        expect(prose).toBe('2 memories · 2 keywords');
        expect(prose).not.toContain('theme');
    });

    it('still counts notes separately', () => {
        const atoms = [atom(['a']), atom([], 'note')];

        expect(memoryPortraitProse(atoms)).toBe('2 memories · 1 keyword · 1 note');
    });

    it('says nothing about keywords when there are none', () => {
        expect(memoryPortraitProse([atom([], 'note')])).toBe('1 memory · 1 note');
    });

    it('describes an empty store without inventing counts', () => {
        expect(memoryPortraitProse([])).toBe('0 memories');
    });
});
