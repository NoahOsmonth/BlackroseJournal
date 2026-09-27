import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

/**
 * Static guard: no vendor-specific gateway, model-roster or free-tier
 * vocabulary may appear in shipped source.
 *
 * Why this exists: the app is provider-agnostic by design. The user supplies
 * an OpenAI-compatible base URL, key and model through an on-device provider
 * profile; no vendor host, port, model id or price tier is baked into the code.
 * That property was established by deleting a hardcoded gateway and the whole
 * free-only concept, and it is invisible to every other test — a stray
 * placeholder or help string re-teaches the vendor taxonomy to users without
 * breaking a single assertion. This test is the tripwire.
 *
 * History is deliberately NOT scanned. Dated logs (PROGRESS.md, docs/plans,
 * .planning, docs/qa) legitimately record what was removed; rewriting them
 * would make the repo's history lie.
 */
const SOURCE_DIRS = ['app', 'components', 'hooks', 'services', 'features', 'constants', 'utils'];
const SOURCE_GLOB = `{${SOURCE_DIRS.join(',')}}/**/*.{ts,tsx}`;

/** Tokens that only ever belong to a specific vendor's gateway or roster. */
const VENDOR_TOKENS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
    { name: 'omniroute', pattern: /omniroute/i },
    { name: 'nano-gpt / nano_gpt', pattern: /nano[-_]?gpt/i },
    { name: 'openrouter', pattern: /openrouter/i },
    { name: 'vendor free-tier roster ids', pattern: /qwen[-_]?web|qwen3\.8/i },
    { name: 'hardcoded gateway host', pattern: /100\.107\.7\.52/ },
    { name: 'hardcoded gateway port', pattern: /:20128\b/ },
];

/**
 * Files permitted to name a vendor token, each with the reason it must.
 * Keep this empty unless a real migration path needs it — an entry here is a
 * hole in the guard.
 */
const ALLOWLIST: ReadonlyMap<string, string> = new Map<string, string>();

function sourceFiles(): string[] {
    return glob.sync(SOURCE_GLOB, {
        cwd: process.cwd(),
        nodir: true,
        ignore: ['**/node_modules/**', '**/.expo/**', '**/dist/**'],
    });
}

describe('vendorLeakage — no vendor gateway/roster vocabulary in shipped source', () => {
    it('scans a non-trivial number of source files (sanity)', () => {
        // Guards against the classic silent pass: a glob that matches nothing
        // makes every assertion below vacuously true.
        const files = sourceFiles();
        expect(files.length).toBeGreaterThan(100);
    });

    it('names no vendor token in app/, components/, hooks/, services/, features/, constants/ or utils/', () => {
        const violations: { file: string; line: number; token: string; content: string }[] = [];

        for (const relativeFile of sourceFiles()) {
            if (ALLOWLIST.has(relativeFile)) {
                continue;
            }
            const content = fs.readFileSync(path.join(process.cwd(), relativeFile), 'utf-8');
            content.split(/\r?\n/).forEach((line, index) => {
                for (const { name, pattern } of VENDOR_TOKENS) {
                    if (pattern.test(line)) {
                        violations.push({
                            file: relativeFile,
                            line: index + 1,
                            token: name,
                            content: line.trim(),
                        });
                    }
                }
            });
        }

        if (violations.length > 0) {
            const message = violations
                .map((v) => `  ${v.file}:${v.line}  [${v.token}]  ${v.content}`)
                .join('\n');
            throw new Error(
                `Vendor vocabulary found in shipped source. The app must stay ` +
                `provider-agnostic: derive hosts/models from the user's provider ` +
                `profile, never from a baked-in vendor. Use a vendor-neutral ` +
                `example (e.g. gpt-4o-mini) in placeholders and help text.\n${message}`
            );
        }

        expect(violations).toEqual([]);
    });

    it('the vendor patterns actually match their canonical tokens (regression lock-in)', () => {
        // If a pattern is loosened into uselessness, fail loudly rather than
        // letting the guard above pass for the wrong reason.
        const samples: ReadonlyArray<[string, string]> = [
            ['omniroute', 'https://omniroute.example/v1'],
            ['nano-gpt / nano_gpt', 'EXPO_PUBLIC_NANO_GPT_BASE'],
            ['openrouter', 'https://openrouter.ai/api/v1'],
            ['vendor free-tier roster ids', 'placeholder=":free, qwen-web/"'],
            ['hardcoded gateway host', 'http://100.107.7.52:20128/v1'],
            ['hardcoded gateway port', 'baseUrl: "http://host:20128/v1"'],
        ];
        for (const [name, sample] of samples) {
            const entry = VENDOR_TOKENS.find((t) => t.name === name);
            expect(entry).toBeDefined();
            expect(entry!.pattern.test(sample)).toBe(true);
        }
    });

    it('does not flag vendor-neutral model examples (no false positives)', () => {
        const safe = [
            "placeholder=\"gpt-4o, claude-\"",
            'Type a model id when fetch cannot list it (e.g. gpt-4o-mini).',
            "model: 'merge/deepseek/deepseek-v4-flash-0731'",
            '// Matched against the whole id (prefixes and `:free` tag included).',
        ];
        for (const line of safe) {
            for (const { pattern } of VENDOR_TOKENS) {
                expect(pattern.test(line)).toBe(false);
            }
        }
    });
});
