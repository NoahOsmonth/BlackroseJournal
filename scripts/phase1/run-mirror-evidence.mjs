import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const requiredImplementationPaths = [
    'scripts/verify-cloud-memory-phase1-immutables.mjs',
    'scripts/phase1/mirror-fault-proxy.mjs',
    'scripts/phase1/mirror-hosted-e2e.mjs',
    'scripts/phase1/mirror-app-e2e.mjs',
    'scripts/phase1/android-ui-driver.mjs',
    'scripts/phase1/rotate-writer-lease.mjs',
    'scripts/phase1/deploy-heroku.mjs',
];
const secretPattern = /(?:bearer\s+[a-z0-9._~+/=-]{12,}|(?:sk|sbp|eyJ)[-_a-z0-9.]{16,}|(?:password|token|secret|api[_-]?key)\s*[=:]\s*\S+)/i;

function git(repositoryRoot, args) {
    const result = spawnSync('git', ['-C', repositoryRoot, ...args], { encoding: 'utf8' });
    if (result.status !== 0) {
        throw new Error(`git ${args[0]} failed`);
    }
    return result.stdout.trim();
}

function sha256(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function parseArguments(argv) {
    const options = { mode: undefined, requiredFiles: [] };
    for (let index = 0; index < argv.length; index += 1) {
        const option = argv[index];
        const value = argv[index + 1];
        if (option === '--required-file' && value) {
            options.requiredFiles.push(value);
            index += 1;
        } else if (['--mode', '--repository-root', '--expected-commit', '--evidence-dir', '--commands-file', '--target'].includes(option) && value) {
            options[option.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
            index += 1;
        } else {
            throw new Error(`Unknown or incomplete option: ${option}`);
        }
    }
    if (!['local', 'hosted', 'app'].includes(options.mode)) {
        throw new Error('A mode of local, hosted, or app is required.');
    }
    for (const required of ['repositoryRoot', 'expectedCommit', 'evidenceDir']) {
        if (!options[required]) {
            throw new Error(`--${required.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} is required.`);
        }
    }
    return {
        ...options,
        evidenceDir: path.resolve(options.evidenceDir),
        repositoryRoot: path.resolve(options.repositoryRoot),
    };
}

function ensureOutsideRepository(repositoryRoot, evidenceDir) {
    const relative = path.relative(repositoryRoot, evidenceDir);
    if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
        throw new Error('Evidence directory must be outside the repository.');
    }
}

function readCommands(options) {
    if (options.commandsFile) {
        const value = JSON.parse(fs.readFileSync(options.commandsFile, 'utf8'));
        if (!Array.isArray(value)) {
            throw new Error('Commands file must contain an array.');
        }
        return value;
    }
    const node = process.execPath;
    const commands = {
        local: [
            { name: 'roadmap-validator', argv: [node, 'scripts/validate-cloud-memory-roadmap.mjs'] },
            { name: 'immutable-guard', argv: [node, 'scripts/verify-cloud-memory-phase1-immutables.mjs'] },
            { name: 'cleanup', argv: [node, '-e', 'process.exit(0)'], cleanup: true },
        ],
        hosted: [
            { name: 'hosted-fixture', argv: [node, 'scripts/phase1/mirror-hosted-e2e.mjs'] },
            { name: 'cleanup', argv: [node, '-e', 'process.exit(0)'], cleanup: true },
        ],
        app: [
            { name: 'app-fixture', argv: [node, 'scripts/phase1/mirror-app-e2e.mjs', '--target', options.target ?? 'web'] },
            { name: 'cleanup', argv: [node, '-e', 'process.exit(0)'], cleanup: true },
        ],
    };
    return commands[options.mode];
}

function validateCommands(commands) {
    if (!commands.some((command) => command?.cleanup === true)) {
        throw new Error('Evidence commands require an explicit cleanup child.');
    }
    for (const command of commands) {
        if (!command || typeof command.name !== 'string' || command.name.length === 0) {
            throw new Error('Every evidence child needs a name.');
        }
        if (!Array.isArray(command.argv) || command.argv.length === 0 || !command.argv.every((value) => typeof value === 'string')) {
            throw new Error(`Evidence child ${command.name} has no executable argv.`);
        }
    }
}

function assertRequiredFiles(options) {
    const required = options.commandsFile ? options.requiredFiles : [...requiredImplementationPaths, ...options.requiredFiles];
    for (const relativePath of required) {
        if (!fs.existsSync(path.join(options.repositoryRoot, relativePath))) {
            throw new Error(`Required implementation path is missing: ${relativePath}`);
        }
    }
}

function staleManifest(evidenceDir, expectedCommit) {
    const manifestPath = path.join(evidenceDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return;
    const prior = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (prior.implementationCommit !== expectedCommit) {
        throw new Error('Stale evidence manifest belongs to a different implementation commit.');
    }
    throw new Error('Evidence directory already contains a manifest for this implementation commit.');
}

function testTotals(output) {
    const match = output.match(/Tests:\s+(\d+)\s+passed(?:,\s*(\d+)\s+failed)?/i) ?? output.match(/(\d+)\s+tests?\s+passed/i);
    return match ? { passed: Number(match[1]), failed: Number(match[2] ?? 0) } : null;
}

function incompleteManifest(options, error) {
    try {
        fs.mkdirSync(options.evidenceDir, { recursive: true });
        fs.writeFileSync(path.join(options.evidenceDir, 'manifest.incomplete.json'), JSON.stringify({
            complete: false,
            implementationCommit: options.expectedCommit,
            reason: error instanceof Error ? error.message : String(error),
        }, null, 2));
    } catch {
        // Preserve the original evidence failure.
    }
}

function runChild(command, repositoryRoot) {
    if (command.skip === true) {
        throw new Error(`Evidence child ${command.name} was skipped.`);
    }
    const [executable, ...argv] = command.argv;
    const result = spawnSync(executable, argv, { cwd: repositoryRoot, encoding: 'utf8' });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    if (secretPattern.test(output)) {
        throw new Error(`Evidence child ${command.name} emitted secret-shaped output.`);
    }
    if (result.status !== 0) {
        throw new Error(`Evidence child ${command.name} exited ${result.status ?? 'without a status'}.`);
    }
    const totals = testTotals(output);
    if (totals?.passed === 0 && /tests?/i.test(output)) {
        throw new Error(`Evidence child ${command.name} reported zero matching tests.`);
    }
    return { cleanup: command.cleanup === true, name: command.name, outputSha256: sha256(output), status: result.status, testTotals: totals };
}

function runEvidence(options) {
    ensureOutsideRepository(options.repositoryRoot, options.evidenceDir);
    fs.mkdirSync(options.evidenceDir, { recursive: true });
    staleManifest(options.evidenceDir, options.expectedCommit);
    const actualCommit = git(options.repositoryRoot, ['rev-parse', 'HEAD']);
    if (actualCommit !== options.expectedCommit) {
        throw new Error(`Wrong implementation commit: expected ${options.expectedCommit}, found ${actualCommit}.`);
    }
    const dirty = git(options.repositoryRoot, ['status', '--porcelain']);
    if (dirty) {
        throw new Error('Dirty checkout prevents evidence collection.');
    }
    assertRequiredFiles(options);
    const commands = readCommands(options);
    validateCommands(commands);
    const children = [];
    let primaryFailure;
    let cleanupFailure;
    for (const command of commands.filter((candidate) => candidate.cleanup !== true)) {
        try {
            children.push(runChild(command, options.repositoryRoot));
        } catch (error) {
            primaryFailure ??= error;
        }
    }
    for (const command of commands.filter((candidate) => candidate.cleanup === true)) {
        try {
            children.push(runChild(command, options.repositoryRoot));
        } catch (error) {
            cleanupFailure ??= error;
        }
    }
    if (primaryFailure && cleanupFailure) {
        throw new Error(`${primaryFailure.message} Cleanup also failed: ${cleanupFailure.message}`);
    }
    if (primaryFailure) throw primaryFailure;
    if (cleanupFailure) throw cleanupFailure;
    const migrationPath = path.join(options.repositoryRoot, 'supabase/migrations/20260729062655_cloud_memory_phase_1_mirror.sql');
    const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath) : Buffer.alloc(0);
    const manifest = {
        children,
        complete: true,
        deployableTreeSha256: sha256(git(options.repositoryRoot, ['ls-files', '-s'])),
        implementationCommit: actualCommit,
        migration: { sha256: sha256(migration), version: '20260729062655' },
        mode: options.mode,
        startedAtUtc: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(options.evidenceDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    return manifest;
}

function main() {
    let options;
    try {
        options = parseArguments(process.argv.slice(2));
        const manifest = runEvidence(options);
        process.stdout.write(`Phase 1 ${manifest.mode} evidence complete: ${manifest.implementationCommit}\n`);
    } catch (error) {
        if (options) incompleteManifest(options, error);
        process.stderr.write(`Phase 1 evidence incomplete: ${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
    }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
