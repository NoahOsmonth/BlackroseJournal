/**
 * Every control in the photo block is a real target (Kaneo #110).
 *
 * This is a source check, not a render check: jsdom has no layout, so a Pressable
 * measures 0x0 in Jest no matter what it says. The audit measures the real thing
 * in a browser; this stops the class from coming back in a diff where nobody runs
 * the audit.
 */
import fs from 'fs';
import path from 'path';

import { relPosix } from '../mocks/repoPath';

const ROOT = process.cwd();

function read(relative: string): string {
    return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

/** Split a file into the className strings it declares. */
function classNames(source: string): string[] {
    return [...source.matchAll(/className=(?:"([^"]*)"|{([^}]*)})/g)].map(
        (match) => match[1] ?? match[2] ?? '',
    );
}

describe('photo controls are thumb-sized', () => {
    it('gives the remove control a 44px floor instead of padding alone', () => {
        const source = read(relPosix(ROOT, path.join(ROOT, 'components/journal/EntryPhoto.tsx')));
        const index = source.indexOf('testID="entry-photo-remove"');
        expect(index).toBeGreaterThan(0);
        // The className for that Pressable sits on the following lines.
        const block = source.slice(index - 400, index + 200);
        expect(block).toContain('min-h-11');
    });

    it('never sizes a pressable with padding alone', () => {
        const offenders: string[] = [];
        for (const file of ['components/journal/EntryPhoto.tsx', 'components/journal/PhotoViewer.tsx']) {
            const source = read(relPosix(ROOT, path.join(ROOT, file)));
            for (const cls of classNames(source)) {
                const padded = /(^|\s)py-\d/.test(cls);
                const hasFloor = /(^|\s)(min-h-1[01]|h-1[01]|h-full|flex-1|absolute)(\s|$)/.test(cls);
                if (padded && !hasFloor) offenders.push(file + ' -> ' + cls);
            }
        }
        expect(offenders).toEqual([]);
    });
});
