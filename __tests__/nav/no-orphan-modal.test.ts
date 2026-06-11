import fs from 'fs';
import path from 'path';

describe('orphan modal route cleanup', () => {
    it('removes the Expo template modal route and registers memory graph', () => {
        const appDir = path.join(process.cwd(), 'app');
        const layout = fs.readFileSync(path.join(appDir, '_layout.tsx'), 'utf8');

        expect(fs.existsSync(path.join(appDir, 'modal.tsx'))).toBe(false);
        expect(layout).not.toContain('name="modal"');
        expect(layout).toContain('name="memory-graph"');
    });
});
