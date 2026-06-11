import * as fs from 'fs';
import * as path from 'path';

const ROOTS = ['app', 'components'];
const PATTERN = /\bspace-[xy]-(?:\d+|px|reverse)\b/;

function collectTsxFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return collectTsxFiles(full);
        return entry.name.endsWith('.tsx') || entry.name.endsWith('.ts') ? [full] : [];
    });
}

describe('NativeWind v4 dead utilities', () => {
    it('bans space-y-*/space-x-* (silently dropped on native; use gap-* on the flex container)', () => {
        const offenders: string[] = [];
        ROOTS.forEach((root) => {
            const rootPath = path.join(process.cwd(), root);
            if (!fs.existsSync(rootPath)) return;
            collectTsxFiles(rootPath).forEach((file) => {
                const content = fs.readFileSync(file, 'utf8');
                if (PATTERN.test(content)) {
                    offenders.push(path.relative(process.cwd(), file));
                }
            });
        });
        expect(offenders).toEqual([]);
    });
});
