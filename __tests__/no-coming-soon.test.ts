import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

describe('no dead coming-soon affordances', () => {
    it('does not ship coming-soon copy in app or components', () => {
        const roots = ['app', 'components'];
        const violations = roots.flatMap((root) => (
            glob.sync('**/*.{ts,tsx}', { cwd: path.join(process.cwd(), root) })
                .map((file) => path.join(root, file))
                .filter((file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')
                    .toLowerCase()
                    .includes('coming soon'))
        ));

        expect(violations).toEqual([]);
    });
});
