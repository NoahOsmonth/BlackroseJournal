import { spawnSync } from 'child_process';
import path from 'path';

const script = path.resolve(__dirname, '../../scripts/phase1/mirror-fault-proxy.mjs');

describe('mirror-fault-proxy', () => {
    it('describes only the named recoverability faults without starting a proxy in dry-run mode', () => {
        const result = spawnSync(process.execPath, [script, '--dry-run', '--faults', 'before-body,after-commit,permit-expiry,retry-after,transient-500,timeout'], { encoding: 'utf8' });

        expect(result.status).toBe(0);
        expect(result.stdout).toMatch(/before-body/);
        expect(result.stdout).toMatch(/after-commit/);
    });

    it('rejects an unbounded fault name', () => {
        const result = spawnSync(process.execPath, [script, '--dry-run', '--faults', 'drop-everything'], { encoding: 'utf8' });

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/unsupported/i);
    });
});
