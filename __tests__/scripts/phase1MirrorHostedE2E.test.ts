import { spawnSync } from 'child_process';
import path from 'path';

const script = path.resolve(__dirname, '../../scripts/phase1/mirror-hosted-e2e.mjs');

describe('mirror-hosted-e2e', () => {
    it('emits only synthetic fixture identifiers in dry-run mode', () => {
        const result = spawnSync(process.execPath, [script, '--dry-run'], { encoding: 'utf8' });

        expect(result.status).toBe(0);
        expect(result.stdout).toMatch(/runNonce|ownerIds/);
        expect(result.stdout).not.toMatch(/password|token|bearer|service_role/i);
    });
});
