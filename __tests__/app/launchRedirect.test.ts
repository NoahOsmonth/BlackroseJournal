import * as fs from 'node:fs';
import * as path from 'node:path';

const source = fs.readFileSync(path.join(__dirname, '../../app/index.tsx'), 'utf8');

describe('launch redirect', () => {
    it('lands users on the Today tab, matching the first tab in the tab bar', () => {
        expect(source).toContain('<Redirect href="/(tabs)/today" />');
        expect(source).not.toContain('/(tabs)/entries');
    });
});
