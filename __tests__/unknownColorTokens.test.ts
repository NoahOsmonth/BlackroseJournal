import fs from 'fs';
import path from 'path';

import { relPosix } from './mocks/repoPath';

/**
 * DEF-033: a border token that does not exist renders as pure black.
 *
 * NativeWind drops unknown utilities silently. `border-border-light` was never
 * defined (the token is `hairline-light`), so the week card shipped with a black
 * 1px outline in light mode while every neighbouring card had the warm hairline.
 * No type check, lint rule or design gate can see it — only the config can.
 */
describe('border tokens used in UI exist in the theme config', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require(path.join(process.cwd(), 'tailwind.config.js'));
    const colors: Record<string, unknown> = config?.theme?.extend?.colors ?? {};

    function uiFiles(dir: string, out: string[] = []): string[] {
        for (const entry of fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true })) {
            const rel = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === 'node_modules') continue;
                uiFiles(rel, out);
            } else if (entry.name.endsWith('.tsx')) {
                out.push(rel);
            }
        }
        return out;
    }

    it('has no border or background class naming a missing color token', () => {
        const offenders: string[] = [];
        const pattern = /\b(border|bg|text|fill|stroke)-([a-z][a-z0-9-]*?)-(light|dark)\b/g;

        for (const file of [...uiFiles('components'), ...uiFiles('app')]) {
            const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
            for (const match of source.matchAll(pattern)) {
                const token = `${match[2]}-${match[3]}`;
                // `border-collapse` style utilities and `dark:` prefixes are not colors.
                if (match[1] === 'format') continue;
                if (!(token in colors)) {
                    offenders.push(`${relPosix(process.cwd(), path.join(process.cwd(), file))}: ${match[0]}`);
                }
            }
        }

        expect(offenders).toEqual([]);
    });
});
