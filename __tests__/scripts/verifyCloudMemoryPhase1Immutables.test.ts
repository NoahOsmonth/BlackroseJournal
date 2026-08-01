import { spawnSync, type SpawnSyncReturns } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const repositoryRoot = path.resolve(__dirname, '..', '..');
const verifierPath = path.join(
    repositoryRoot,
    'scripts',
    'verify-cloud-memory-phase1-immutables.mjs',
);

function run(command: string, args: string[], cwd: string): SpawnSyncReturns<string> {
    return spawnSync(command, args, { cwd, encoding: 'utf8' });
}

function writeFile(root: string, relativePath: string, content: string): void {
    const destination = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content);
}

function createRepository(root: string): string {
    run('git', ['init', '--quiet'], root);
    run('git', ['config', 'user.email', 'phase1@example.test'], root);
    run('git', ['config', 'user.name', 'Phase 1 Test'], root);

    writeFile(root, 'package-lock.json', '{"lockfileVersion":3}\n');
    writeFile(root, 'backend/package-lock.json', '{"lockfileVersion":3}\n');
    writeFile(root, 'example-design/today.html', '<main>immutable</main>\n');
    writeFile(root, 'supabase/migrations/202601240001_init.sql', 'select 1;\n');
    writeFile(root, 'supabase/migrations/20260728112723_applied.sql', 'select 2;\n');
    run('git', ['add', '.'], root);
    run('git', ['commit', '--quiet', '-m', 'baseline'], root);
    return run('git', ['rev-parse', 'HEAD'], root).stdout.trim();
}

function verify(root: string, base: string): SpawnSyncReturns<string> {
    return run(process.execPath, [verifierPath, root, '--base', base], root);
}

describe('verify-cloud-memory-phase1-immutables', () => {
    let fixtureRoot: string;
    let baseline: string;

    beforeEach(() => {
        fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase1-immutables-'));
        baseline = createRepository(fixtureRoot);
    });

    afterEach(() => {
        fs.rmSync(fixtureRoot, { force: true, recursive: true });
    });

    it('permits the unapplied Phase 1 migration while applied baseline blobs remain unchanged', () => {
        writeFile(
            fixtureRoot,
            'supabase/migrations/20260729062655_cloud_memory_phase_1_mirror.sql',
            '',
        );

        const result = verify(fixtureRoot, baseline);

        expect(result.status).toBe(0);
        expect(result.stdout).toMatch(/immutable/i);
    });

    it.each([
        ['an applied migration', 'supabase/migrations/20260728112723_applied.sql'],
        ['the root lockfile', 'package-lock.json'],
        ['an example-design blob', 'example-design/today.html'],
    ])('rejects changes to %s', (_description, relativePath) => {
        fs.appendFileSync(path.join(fixtureRoot, relativePath), 'changed\n');

        const result = verify(fixtureRoot, baseline);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(new RegExp(relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    });
});
