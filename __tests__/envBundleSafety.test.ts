import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

/**
 * Static safety net for SG-1: ensure no `EXPO_PUBLIC_*_KEY` / `_SECRET` / `_TOKEN`
 * environment variables are committed anywhere in the repo. Expo inlines
 * every `EXPO_PUBLIC_*` var at build time, so a key with that prefix would
 * land in the mobile bundle.
 *
 * This test runs in `npm test` and fails the build if any `.env*` file
 * (root, backend, examples) contains such a variable. The matching
 * ESLint rule (`no-restricted-syntax` in eslint.config.js) is the
 * in-editor companion that catches future regressions in source code.
 */
const FORBIDDEN_ENV_PATTERN = /^EXPO_PUBLIC_[A-Z0-9_]*(KEY|SECRET|TOKEN)\s*=/i;
const ENV_FILE_GLOB = '**/.env*';

/**
 * Vars that the Supabase/Expo ecosystem intentionally exposes to the
 * client bundle. They end in `_KEY` (or `_TOKEN`) but are designed to
 * be public — Supabase's anon key is shipped in every client by design,
 * and Expo's `EXPO_PUBLIC_*` namespace is literally "safe to inline".
 *
 * Keep this list tight. If you add an entry, document WHY it is safe to
 * ship in the mobile bundle (e.g., a third-party service's public
 * client identifier, a non-secret JWT audience claim, etc.).
 */
const KNOWN_PUBLIC_EXPO_VARS: ReadonlySet<string> = new Set([
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
]);

function findEnvFiles(): string[] {
    return glob.sync(ENV_FILE_GLOB, {
        cwd: process.cwd(),
        nodir: true,
        dot: true,
        ignore: [
            '**/node_modules/**',
            '**/.expo/**',
            '**/dist/**',
            '**/.git/**',
        ],
    });
}

function isEnvFile(filepath: string): boolean {
    const base = path.basename(filepath);
    return base === '.env' || base.startsWith('.env.');
}

describe('envBundleSafety — no EXPO_PUBLIC_* secrets in committed env files', () => {
    it('finds at least one .env* file in the repo (sanity)', () => {
        const envFiles = findEnvFiles().filter(isEnvFile);
        expect(envFiles.length).toBeGreaterThan(0);
    });

    it('no .env* file in the repo contains EXPO_PUBLIC_*_KEY/_SECRET/_TOKEN', () => {
        const envFiles = findEnvFiles().filter(isEnvFile);
        const violations: Array<{ file: string; line: number; content: string }> = [];

        for (const relativeFile of envFiles) {
            const absoluteFile = path.join(process.cwd(), relativeFile);
            const content = fs.readFileSync(absoluteFile, 'utf-8');
            const lines = content.split(/\r?\n/);

            lines.forEach((line, index) => {
                if (!FORBIDDEN_ENV_PATTERN.test(line)) {
                    return;
                }
                const varName = line.split('=')[0]?.trim();
                if (varName && KNOWN_PUBLIC_EXPO_VARS.has(varName)) {
                    return;
                }
                violations.push({
                    file: relativeFile,
                    line: index + 1,
                    content: line.trim(),
                });
            });
        }

        if (violations.length > 0) {
            const message = violations
                .map((v) => `  ${v.file}:${v.line}  ${v.content}`)
                .join('\n');
            throw new Error(
                `Found EXPO_PUBLIC_*_KEY/_SECRET/__TOKEN in committed env files. ` +
                `These are inlined into the Expo mobile bundle. Remove them. ` +
                `Use AGENT_API_KEY server-side only.\n${message}`
            );
        }

        expect(violations).toEqual([]);
    });

    it('forbidden pattern matches EXPO_PUBLIC_FOO_KEY= (regression lock-in)', () => {
        // If the regex changes shape in a way that no longer catches the
        // canonical regression example, fail loudly. This guarantees that
        // the static test and the ESLint rule (which share the pattern)
        // can never silently stop working.
        const samples = [
            'EXPO_PUBLIC_FOO_KEY=abc',
            'EXPO_PUBLIC_FOO_SECRET=abc',
            'EXPO_PUBLIC_FOO_TOKEN=abc',
            'expo_public_foo_key=abc', // case-insensitive
            'EXPO_PUBLIC_OPENAI_API_KEY=sk-123',
        ];
        for (const sample of samples) {
            expect(FORBIDDEN_ENV_PATTERN.test(sample)).toBe(true);
        }
    });

    it('forbidden pattern does NOT match safe EXPO_PUBLIC_ vars', () => {
        // Sanity: legitimate Expo-public vars (no secret suffix) must not
        // be flagged. The ESLint rule would not match these either.
        const safe = [
            'EXPO_PUBLIC_AGENT_BASE_URL=http://localhost:8787',
            'EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co',
        ];
        for (const sample of safe) {
            expect(FORBIDDEN_ENV_PATTERN.test(sample)).toBe(false);
        }
    });

    it('whitelist contains only legitimate public-key entries (security guard)', () => {
        // The whitelist is the ONLY deviation from the plan's regex. To
        // prevent silent regression, every entry must:
        //   1. Start with EXPO_PUBLIC_
        //   2. End in _KEY / _SECRET / _TOKEN (otherwise it would never
        //      match the pattern and shouldn't be in this list)
        expect(KNOWN_PUBLIC_EXPO_VARS.size).toBeGreaterThan(0);
        for (const varName of KNOWN_PUBLIC_EXPO_VARS) {
            expect(varName.startsWith('EXPO_PUBLIC_')).toBe(true);
            expect(FORBIDDEN_ENV_PATTERN.test(`${varName}=value`)).toBe(true);
        }
    });
});
