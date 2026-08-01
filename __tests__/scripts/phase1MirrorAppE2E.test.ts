import { spawnSync } from 'child_process';
import path from 'path';

const script = path.resolve(__dirname, '../../scripts/phase1/mirror-app-e2e.mjs');

describe('mirror-app-e2e', () => {
    it('reports a content-free fixture handshake in dry-run mode', () => {
        const result = spawnSync(process.execPath, [script, '--dry-run', '--target', 'web'], { encoding: 'utf8' });

        expect(result.status).toBe(0);
        expect(result.stdout).toMatch(/web/);
        expect(result.stdout).toMatch(/runNonce/);
        expect(result.stdout).not.toMatch(/journal|assistant|synthetic phrase/i);
    });
});
