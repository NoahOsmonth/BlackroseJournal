import fs from 'fs';
import path from 'path';

describe('simplemem bridge runtime deps', () => {
    it('does not depend on binary-heavy lancedb/pyarrow runtime packages', () => {
        const requirementsPath = path.join(process.cwd(), 'backend', 'requirements-simplemem.txt');
        const requirements = fs.readFileSync(requirementsPath, 'utf-8').toLowerCase();

        expect(requirements).toContain('httpx');
        expect(requirements).not.toContain('lancedb');
        expect(requirements).not.toContain('pyarrow');
    });
});
