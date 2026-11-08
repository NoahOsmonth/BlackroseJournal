import fs from 'fs';
import path from 'path';

import { relPosix } from './mocks/repoPath';

/**
 * Rule 1 guard: a <Text> that sets a text colour must also work in dark mode.
 *
 * React Native text does NOT inherit colour from its parent View, so a bare
 * light-only colour is invisible in dark mode. That shipped before and is the
 * single most common colour bug in this repo.
 *
 * A colour counts as safe if ANY of these is true:
 *   - the className carries a dark: variant
 *   - the colour comes from an inline style, where the author is already
 *     responsible for both schemes (theme tokens, isDark branches)
 *   - the className only sets size/weight/spacing, leaving colour to style
 *
 * This scans className colour classes only, because those are the ones that
 * silently mean 'light mode forever'.
 */

const TARGETS = ['app', 'components'];

// text-text-light, text-white, text-gray-900 … but not text-[15px] or text-center
const COLOUR_CLASS = /(?:^|\s)text-(?!\[|center|left|right|justify|balance|ellipsis|uppercase|lowercase|capitalize)[a-z]/;

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (entry.name.endsWith('.tsx')) out.push(full);
    }
    return out;
}

interface Offender {
    file: string;
    line: number;
    className: string;
}

function findColourWithoutDark(): Offender[] {
    const root = process.cwd();
    const offenders: Offender[] = [];

    for (const target of TARGETS) {
        const dir = path.join(root, target);
        if (!fs.existsSync(dir)) continue;
        for (const file of walk(dir)) {
            const source = fs.readFileSync(file, 'utf8');
            // Opening <Text …> tags, allowing attributes to span lines.
            const tag = /<Text\b([^>]*)>/g;
            let match: RegExpExecArray | null;
            while ((match = tag.exec(source)) !== null) {
                const attrs = match[1];
                if (/\bstyle=/.test(attrs)) continue;

                const className = /className=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(attrs);
                if (!className) continue;
                const value = className[1] ?? className[2] ?? '';

                if (value.includes('dark:')) continue;
                // A dynamic class is the caller's shape to get right; the call
                // site cannot see the colour, so flagging it is noise.
                if (value.includes('${')) continue;
                if (!COLOUR_CLASS.test(value)) continue;

                const line = source.slice(0, match.index).split('\n').length;
                offenders.push({ file: relPosix(root, file), line, className: value.trim() });
            }
        }
    }
    return offenders;
}

describe('every coloured <Text> has a dark mode colour', () => {
    it('finds no light-only text colour without an inline style', () => {
        const offenders = findColourWithoutDark();
        const report = offenders.map((o) => `${o.file}:${o.line}  ${o.className}`).join('\n');
        expect(report).toBe('');
    });

    it('actually scans the app, so a passing result means something', () => {
        const files = TARGETS.flatMap((t) => {
            const dir = path.join(process.cwd(), t);
            return fs.existsSync(dir) ? walk(dir) : [];
        });
        expect(files.length).toBeGreaterThan(50);
    });
});
