import fs from 'fs';
import path from 'path';

describe('theme palette hygiene', () => {
    it('does not export the old cyan slop palette', () => {
        const content = fs.readFileSync(
            path.join(process.cwd(), 'constants', 'theme.ts'),
            'utf8'
        ).toLowerCase();

        expect(content).not.toContain('#45f3ff');
        expect(content).not.toContain('#0b0c10');
    });
});
