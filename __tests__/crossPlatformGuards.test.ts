import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

/**
 * Static guard: this repo is developed on **Windows and Linux**, so tests and
 * scripts must not depend on one of them.
 *
 * Two real incidents, both green on Linux and red on Windows:
 *
 *  1. `execFile('grep', …)` — `__tests__/metro-phosphor-resolve.test.ts` shelled
 *     out to grep, which does not exist on Windows (`execFile ENOENT`). Tests
 *     scan in-process instead.
 *  2. `path.relative()` compared to a forward-slash literal —
 *     `__tests__/components/bottomSheetKeyboard.test.ts` built expectations like
 *     `'components/goals/GoalEditModal.tsx'`, which is
 *     `components\goals\GoalEditModal.tsx` on Windows. Paths now go through
 *     `__tests__/mocks/repoPath.ts` (`relPosix`).
 *
 * A third class is guarded here too: an absolute path from either OS
 * (a `C:\Users\...` path for `.agents/skills` once shipped in AGENTS.md).
 *
 * Markdown is deliberately not scanned: `AGENTS.md` and `PROGRESS.md` record
 * these incidents and must be able to name the tokens.
 */
const SCANNED_DIRS = [
    // Test + tooling surfaces: these must run on both platforms.
    '__tests__',
    'scripts',
    'probes',
    // Shipped source: an absolute path from either OS must never be baked in.
    'app',
    'components',
    'hooks',
    'services',
    'features',
    'constants',
    'utils',
];
const SCANNED_GLOB = `{${SCANNED_DIRS.join(',')}}/**/*.{ts,tsx,js,mjs,cjs,py}`;

/**
 * This file must name the very tokens it forbids (the lock-in samples below),
 * so it is skipped. The sanity assertion on the scanned count keeps a single
 * skipped file from hiding a violation anywhere else.
 */
const SELF = 'crossPlatformGuards.test.ts';

/** The one module allowed to call `path.relative` under `__tests__/`. */
const PATH_HELPER = '__tests__/mocks/repoPath.ts';

/** Commands that exist on Linux and not on Windows. */
const POSIX_ONLY_COMMANDS: ReadonlySet<string> = new Set([
    'grep',
    'egrep',
    'fgrep',
    'sed',
    'awk',
    'find',
    'cat',
    'ls',
    'rm',
    'mv',
    'cp',
    'chmod',
    'chown',
    'bash',
    'sh',
    'zsh',
    'which',
    'xargs',
    'tail',
    'head',
    'touch',
    'wc',
    'uniq',
    'cut',
    'python3',
]);

/**
 * A process-spawning call, capturing the command token: handles both
 * `execFile('grep', …)` and a shell string `execSync('grep -rn …')`.
 * The token stops at whitespace or a quote, which is all a command name needs.
 */
const SPAWN_CALL =
    /(?:execFile|execFileSync|execSync|spawn|spawnSync)\s*\(\s*['"`]([^\s'"`]+)/g;

/** A Windows absolute path, in either separator flavour. */
const WINDOWS_ABSOLUTE_PATH = [
    // C:\Users\... — the backslash form.
    String.raw`\b[A-Za-z]:\\[A-Za-z0-9_.\-]`,
    // C:/Users/... — the forward-slash form.
    String.raw`\b[A-Za-z]:/(?:Users|home|Windows|Program Files|dev|projects|tmp)\b`,
].map((source) => new RegExp(source));

/** A direct `path.relative(` call, with the optional whitespace before it. */
const RAW_PATH_RELATIVE = /(^|[^.\w])path\.relative\s*\(/;

function scannedFiles(): string[] {
    return glob
        .sync(SCANNED_GLOB, {
            cwd: process.cwd(),
            nodir: true,
            ignore: ['**/node_modules/**', '**/.expo/**', '**/dist/**', '**/output/**'],
        })
        .map((file) => file.split(path.sep).join('/'))
        .filter((file) => !file.endsWith(SELF));
}

function readAll(): { file: string; lines: string[] }[] {
    return scannedFiles().map((file) => ({
        file,
        // CRLF-tolerant: the repo has no .gitattributes and both endings exist.
        lines: fs.readFileSync(path.join(process.cwd(), file), 'utf-8').split(/\r?\n/),
    }));
}

describe('crossPlatformGuards — Windows and Linux are both dev machines', () => {
    it('scans a non-trivial number of files (sanity)', () => {
        // A glob that matches nothing makes every assertion below vacuously true.
        expect(scannedFiles().length).toBeGreaterThan(200);
    });

    it('never spawns a POSIX-only command from a test or script', () => {
        const violations: string[] = [];

        for (const { file, lines } of readAll()) {
            lines.forEach((line, index) => {
                for (const match of line.matchAll(SPAWN_CALL)) {
                    const command = match[1];
                    if (POSIX_ONLY_COMMANDS.has(command)) {
                        violations.push(`  ${file}:${index + 1}  spawns '${command}'`);
                    }
                }
            });
        }

        if (violations.length > 0) {
            throw new Error(
                `POSIX-only command spawned. It exists on Linux and not on ` +
                `Windows (execFile ENOENT). Scan in-process instead: ` +
                `fs.readdirSync + fs.readFileSync(...).includes(needle).\n` +
                violations.join('\n')
            );
        }

        expect(violations).toEqual([]);
    });

    it('keeps every repo-relative path on the relPosix helper', () => {
        const violations: string[] = [];

        for (const { file, lines } of readAll()) {
            if (!file.startsWith('__tests__/') || file === PATH_HELPER) continue;
            lines.forEach((line, index) => {
                if (RAW_PATH_RELATIVE.test(line)) {
                    violations.push(`  ${file}:${index + 1}  ${line.trim()}`);
                }
            });
        }

        if (violations.length > 0) {
            throw new Error(
                `path.relative() returns backslashes on Windows, so its output ` +
                `must not be compared to a forward-slash literal. Import ` +
                `relPosix from __tests__/mocks/repoPath.ts instead.\n` +
                violations.join('\n')
            );
        }

        expect(violations).toEqual([]);
    });

    it('bakes in no absolute path from either OS', () => {
        const violations: string[] = [];

        for (const { file, lines } of readAll()) {
            lines.forEach((line, index) => {
                for (const pattern of WINDOWS_ABSOLUTE_PATH) {
                    if (pattern.test(line)) {
                        violations.push(`  ${file}:${index + 1}  ${line.trim()}`);
                    }
                }
            });
        }

        if (violations.length > 0) {
            throw new Error(
                `Absolute path baked in. Resolve from the repo root ` +
                `(process.cwd() / __dirname), never from one machine's layout.\n` +
                violations.join('\n')
            );
        }

        expect(violations).toEqual([]);
    });

    it('the patterns match their canonical samples (regression lock-in)', () => {
        // If a pattern is loosened into uselessness, fail loudly rather than
        // letting the guards above pass for the wrong reason.
        const spawnSamples = [
            `execFile('grep', ['-rn', 'from'])`,
            `execSync("sed -i 's/a/b/' file")`,
            'spawnSync(`find . -name "*.ts"`)',
        ];
        for (const sample of spawnSamples) {
            const commands = [...sample.matchAll(SPAWN_CALL)].map((m) => m[1]);
            expect(commands.some((command) => POSIX_ONLY_COMMANDS.has(command))).toBe(true);
        }

        const relativeSamples = [
            'offenders.push(path.relative(process.cwd(), file));',
            'return path.relative(ROOT, file);',
        ];
        for (const sample of relativeSamples) {
            expect(RAW_PATH_RELATIVE.test(sample)).toBe(true);
        }

        const absoluteSamples = [
            String.raw`const skills = 'C:\Users\me\projects\BlackroseJournal\.agents\skills';`,
            `const skills = 'C:/Users/me/projects/BlackroseJournal';`,
        ];
        for (const sample of absoluteSamples) {
            expect(WINDOWS_ABSOLUTE_PATH.some((pattern) => pattern.test(sample))).toBe(true);
        }
    });

    it('does not flag cross-platform commands or repo-relative paths (no false positives)', () => {
        const safeSpawnLines = [
            `execFile('node', ['-e', 'process.exit(0)'])`,
            `execFile('npx', ['playwright', 'test'])`,
            `execFile('git', ['status', '--short'])`,
            `execFile('adb', ['shell', 'input', 'text'])`,
        ];
        for (const line of safeSpawnLines) {
            const commands = [...line.matchAll(SPAWN_CALL)].map((m) => m[1]);
            expect(commands.some((command) => POSIX_ONLY_COMMANDS.has(command))).toBe(false);
        }

        const safeLines = [
            `import path from 'path';`,
            `const rel = relPosix(ROOT, file);`,
            `const url = 'https://api.example.com/v1';`,
            `// grep is not guaranteed on Windows`,
        ];
        for (const line of safeLines) {
            expect(RAW_PATH_RELATIVE.test(line)).toBe(false);
            for (const pattern of WINDOWS_ABSOLUTE_PATH) {
                expect(pattern.test(line)).toBe(false);
            }
        }
    });
});
