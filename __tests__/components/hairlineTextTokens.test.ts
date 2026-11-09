import fs from 'fs';
import path from 'path';

import { relPosix } from '../mocks/repoPath';

/**
 * The hairline tokens are border colours (#E2DCD2 light, #2C2A26 dark). Used as
 * text they measure 1.2:1 and 1.4:1 against their own background - effectively
 * invisible in both schemes. The streak view's weekday captions did exactly
 * that until round 56's browser sweep caught seven 1.4:1 labels on dark.
 *
 * The rule: a 'text-hairline-*' class is always a bug. If a divider needs a
 * text-weight label, use a text token.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const SCANNED = ['app', 'components'];

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
}

describe('border tokens are never used as text colour', () => {
    it('no file paints text with a hairline token', () => {
        const offenders: string[] = [];
        for (const dir of SCANNED) {
            for (const file of walk(path.join(ROOT, dir))) {
                const source = fs.readFileSync(file, 'utf8');
                // 'border-hairline-*' is the correct use; only the text- prefix is wrong.
                if (/\btext-hairline-(light|dark)\b/.test(source)) {
                    offenders.push(relPosix(ROOT, file));
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('the streak view weekday captions use a text token', () => {
        const source = fs.readFileSync(path.join(ROOT, 'app/streak-view.tsx'), 'utf8');
        expect(source).not.toMatch(/\btext-hairline-/);
        expect(source).toContain('text-text-secondary-light dark:text-text-secondary-dark');
    });
});
