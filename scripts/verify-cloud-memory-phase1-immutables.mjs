import { execFileSync } from 'node:child_process';
import path from 'node:path';

export const PHASE1_IMMUTABLE_BASE = 'ef2610f019c21a6b9c0652014d26f3e0fdfbb8b6';

function runGit(repositoryRoot, args) {
    return execFileSync('git', ['-C', repositoryRoot, ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
}

export function parseArguments(argv) {
    const values = [...argv];
    let repositoryRoot = process.cwd();
    let base = PHASE1_IMMUTABLE_BASE;

    if (values[0] && !values[0].startsWith('--')) {
        repositoryRoot = values.shift();
    }
    while (values.length > 0) {
        const option = values.shift();
        if (option === '--base' && values[0]) {
            base = values.shift();
            continue;
        }
        throw new Error(`Unknown or incomplete option: ${option}`);
    }

    return { base, repositoryRoot: path.resolve(repositoryRoot) };
}

export function protectedPaths(repositoryRoot, base) {
    const baselinePaths = runGit(repositoryRoot, ['ls-tree', '-r', '--name-only', base]);
    return baselinePaths
        .split(/\r?\n/)
        .filter((relativePath) =>
            relativePath === 'package-lock.json' ||
            relativePath === 'backend/package-lock.json' ||
            relativePath.startsWith('example-design/') ||
            relativePath.startsWith('supabase/migrations/'),
        );
}

export function verifyImmutables(repositoryRoot, base = PHASE1_IMMUTABLE_BASE) {
    const protectedBaselinePaths = protectedPaths(repositoryRoot, base);
    const changed = runGit(repositoryRoot, [
        'diff',
        '--name-only',
        base,
        '--',
        ...protectedBaselinePaths,
    ])
        .split(/\r?\n/)
        .filter(Boolean);

    return { changed, protectedBaselinePaths };
}

function main() {
    try {
        const { base, repositoryRoot } = parseArguments(process.argv.slice(2));
        const { changed, protectedBaselinePaths } = verifyImmutables(repositoryRoot, base);
        if (changed.length > 0) {
            process.stderr.write(
                `Phase 1 immutable baseline ${base} changed:\n${changed.join('\n')}\n`,
            );
            process.exitCode = 1;
            return;
        }
        process.stdout.write(
            `Phase 1 immutable guard passed (${protectedBaselinePaths.length} baseline blobs).\n`,
        );
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        process.stderr.write(`Phase 1 immutable guard failed: ${detail}\n`);
        process.exitCode = 1;
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
