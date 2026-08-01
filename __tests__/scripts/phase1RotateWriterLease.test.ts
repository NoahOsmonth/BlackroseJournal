import { spawnSync } from 'child_process';
import path from 'path';

const script = path.resolve(__dirname, '../../scripts/phase1/rotate-writer-lease.mjs');

describe('rotate-writer-lease', () => {
    it('creates only IDs and digests during a dry-run lease proposal', () => {
        const result = spawnSync(process.execPath, [script, '--dry-run'], { encoding: 'utf8' });

        expect(result.status).toBe(0);
        expect(result.stdout).toMatch(/leaseId|tokenDigest|controlNonce/);
        expect(result.stdout).not.toMatch(/rawToken|previousToken|lease-secret/i);
    });

    it('rejects raw lease material supplied through process arguments', () => {
        const result = spawnSync(process.execPath, [script, '--old-token', 'lease-secret'], { encoding: 'utf8' });

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/process arguments/i);
    });
});
