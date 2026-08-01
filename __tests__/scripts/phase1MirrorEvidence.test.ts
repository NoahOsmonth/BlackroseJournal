import { spawnSync, type SpawnSyncReturns } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const repositoryRoot = path.resolve(__dirname, '..', '..');
const runnerPath = path.join(repositoryRoot, 'scripts/phase1/run-mirror-evidence.mjs');

function run(command: string, args: string[], cwd: string): SpawnSyncReturns<string> {
    return spawnSync(command, args, { cwd, encoding: 'utf8' });
}

function createRepository(root: string): string {
    run('git', ['init', '--quiet'], root);
    run('git', ['config', 'user.email', 'phase1@example.test'], root);
    run('git', ['config', 'user.name', 'Phase 1 Test'], root);
    fs.writeFileSync(path.join(root, 'tracked.txt'), 'clean\n');
    run('git', ['add', '.'], root);
    run('git', ['commit', '--quiet', '-m', 'fixture'], root);
    return run('git', ['rev-parse', 'HEAD'], root).stdout.trim();
}

function writeCommands(root: string, commands: unknown): string {
    const commandsPath = path.join(root, 'commands.json');
    fs.writeFileSync(commandsPath, JSON.stringify(commands));
    return commandsPath;
}

function child(name: string, source: string, cleanup = false) {
    return { argv: [process.execPath, '-e', source], cleanup, name };
}

describe('run-mirror-evidence', () => {
    let fixtureRoot: string;
    let evidenceRoot: string;
    let commit: string;

    beforeEach(() => {
        fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase1-evidence-repository-'));
        evidenceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase1-evidence-output-'));
        commit = createRepository(fixtureRoot);
    });

    afterEach(() => {
        fs.rmSync(fixtureRoot, { force: true, recursive: true });
        fs.rmSync(evidenceRoot, { force: true, recursive: true });
    });

    function execute(commands: unknown, expectedCommit = commit): SpawnSyncReturns<string> {
        const commandsPath = writeCommands(evidenceRoot, commands);
        return run(
            process.execPath,
            [
                runnerPath,
                '--mode',
                'local',
                '--repository-root',
                fixtureRoot,
                '--expected-commit',
                expectedCommit,
                '--evidence-dir',
                evidenceRoot,
                '--commands-file',
                commandsPath,
            ],
            fixtureRoot,
        );
    }

    function executeWithRequiredFile(commands: unknown, requiredFile: string): SpawnSyncReturns<string> {
        const commandsPath = writeCommands(evidenceRoot, commands);
        return run(
            process.execPath,
            [
                runnerPath,
                '--mode',
                'local',
                '--repository-root',
                fixtureRoot,
                '--expected-commit',
                commit,
                '--evidence-dir',
                evidenceRoot,
                '--commands-file',
                commandsPath,
                '--required-file',
                requiredFile,
            ],
            fixtureRoot,
        );
    }

    it('writes a fresh hashed manifest only after every child and cleanup succeed', () => {
        const result = execute([
            child('contract', "process.stdout.write('2 tests passed\\n')"),
            child('cleanup', "process.stdout.write('cleanup complete\\n')", true),
        ]);

        expect(result.status).toBe(0);
        const manifest = JSON.parse(fs.readFileSync(path.join(evidenceRoot, 'manifest.json'), 'utf8'));
        expect(manifest.implementationCommit).toBe(commit);
        expect(manifest.complete).toBe(true);
        expect(manifest.children).toHaveLength(2);
        expect(manifest.children[0].outputSha256).toMatch(/^[a-f0-9]{64}$/);
    });

    it('marks the manifest incomplete when a required implementation path is missing', () => {
        const result = executeWithRequiredFile(
            [child('cleanup', 'process.exit(0)', true)],
            'scripts/phase1/not-implemented.mjs',
        );

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/required implementation.*missing/i);
    });

    it.each([
        ['a skipped child', [child('contract', "process.exit(0)"), { name: 'skipped', skip: true }, child('cleanup', "process.exit(0)", true)], /skipped/i],
        ['a nonzero child', [child('contract', 'process.exit(9)'), child('cleanup', 'process.exit(0)', true)], /contract.*9/i],
        ['a failed cleanup', [child('contract', 'process.exit(0)'), child('cleanup', 'process.exit(7)', true)], /cleanup.*7/i],
        ['secret-shaped child output', [child('contract', "process.stdout.write('Bearer abcdefghijklmnopqrstuvwxyz0123456789')"), child('cleanup', 'process.exit(0)', true)], /secret/i],
    ])('marks the manifest incomplete for %s', (_description, commands, errorPattern) => {
        const result = execute(commands);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(errorPattern);
    });

    it('runs cleanup after a nonzero primary child while preserving the primary failure', () => {
        const cleanupMarker = path.join(evidenceRoot, 'cleanup-ran');
        const result = execute([
            child('contract', 'process.exit(9)'),
            child('cleanup', `require('fs').writeFileSync(${JSON.stringify(cleanupMarker)}, 'ran')`, true),
        ]);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/contract.*9/i);
        expect(fs.readFileSync(cleanupMarker, 'utf8')).toBe('ran');
    });

    it('rejects a wrong implementation commit before it executes children', () => {
        const result = execute([child('cleanup', 'process.exit(0)', true)], crypto.randomBytes(20).toString('hex'));

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/commit/i);
    });

    it('rejects a dirty checkout', () => {
        fs.appendFileSync(path.join(fixtureRoot, 'tracked.txt'), 'dirty\n');

        const result = execute([child('cleanup', 'process.exit(0)', true)]);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/dirty/i);
    });

    it('rejects a stale prior manifest', () => {
        fs.writeFileSync(
            path.join(evidenceRoot, 'manifest.json'),
            JSON.stringify({ implementationCommit: crypto.randomBytes(20).toString('hex') }),
        );

        const result = execute([child('cleanup', 'process.exit(0)', true)]);

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/stale/i);
    });
});
