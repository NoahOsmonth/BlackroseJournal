/**
 * Guard: production app/ and services/ must never import probe code.
 */

import fs from 'fs';
import path from 'path';

function walkTsFiles(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const st = fs.statSync(full);
        if (st.isDirectory()) {
            if (name === 'node_modules' || name === 'dist') continue;
            walkTsFiles(full, out);
        } else if (/\.(ts|tsx|js|jsx)$/.test(name)) {
            out.push(full);
        }
    }
    return out;
}

describe('probe isolation', () => {
    it('app/ and services/ do not import probes/', () => {
        const roots = [
            path.join(process.cwd(), 'app'),
            path.join(process.cwd(), 'services'),
        ];
        const offenders: string[] = [];
        const importRe = /from\s+['"][^'"]*probes[^'"]*['"]|require\(\s*['"][^'"]*probes[^'"]*['"]\s*\)/;
        for (const root of roots) {
            for (const file of walkTsFiles(root)) {
                const text = fs.readFileSync(file, 'utf-8');
                if (importRe.test(text)) offenders.push(path.relative(process.cwd(), file));
            }
        }
        expect(offenders).toEqual([]);
    });
});
