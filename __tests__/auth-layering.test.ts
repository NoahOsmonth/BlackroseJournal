import fs from 'fs';
import path from 'path';

describe('auth UI layering', () => {
    it('keeps auth route I/O behind hooks', () => {
        const authDir = path.join(process.cwd(), 'app', '(auth)');
        const routeFiles = fs.readdirSync(authDir)
            .filter((file) => file.endsWith('.tsx'));

        for (const file of routeFiles) {
            const source = fs.readFileSync(path.join(authDir, file), 'utf8');
            expect(source).not.toMatch(/from ['"]@\/services\//);
        }
    });
});
