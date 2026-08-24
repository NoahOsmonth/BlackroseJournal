import fs from 'fs';
import path from 'path';

describe('root authentication route gate', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app', '_layout.tsx'), 'utf8');

    it('protects app routes while keeping password recovery reachable', () => {
        expect(source).toMatch(/Stack\.Screen name="\(auth\)"/);
        expect(source).not.toMatch(/Stack\.Protected guard=\{!auth\.isAuthenticated\}/);
        expect(source).toMatch(/Stack\.Protected guard=\{auth\.isAuthenticated\}[\s\S]*name="\(tabs\)"/);
    });

    it('does not start account-bound seed work before the account resolves', () => {
        expect(source).toMatch(/if \(!auth\.user\?\.id\) return;/);
        expect(source).toMatch(/\}, \[auth\.user\?\.id\]\);/);
    });
});
