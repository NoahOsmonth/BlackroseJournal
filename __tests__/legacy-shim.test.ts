/**
 * legacy-shim.test.ts
 *
 * Contract for PR5 — backward-compat shim + deprecation + MIGRATION.md.
 * Reference: `.omo/plans/ai-architecture-redesign.md` PR5.
 *
 * Scenarios:
 *  - S5.1 Happy: NANO_GPT_* (no AI_DEFAULT_*) → shim maps to AI_DEFAULT_*.
 *  - S5.2 Edge:  AI_DEFAULT_* set + NANO_GPT_* set → new wins, no override.
 *  - S5.3 Adjacent: scripts/check-legacy-shim.js with AI_LEGACY_SHIM_OVERRIDE_DATE=2020-01-01
 *                 exits 1 and stderr contains the date.
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
    AI_LEGACY_SHIM_DEPRECATION_DATE,
    __resetLegacyShimWarningForTests,
    applyLegacyShim,
} from '../backend/src/config/aiShim';

describe('AI legacy shim (PR5)', () => {
    const SHIM_PATH = path.join(
        __dirname,
        '..',
        'backend',
        'src',
        'config',
        'aiShim.ts'
    );

    describe('S5.1 — happy path (NANO_GPT_* → AI_DEFAULT_*)', () => {
        it('maps NANO_GPT_API_KEY to AI_DEFAULT_API_KEY when new name is absent', () => {
            const result = applyLegacyShim({
                NANO_GPT_API_KEY: 'sk-legacy',
            });
            expect(result.AI_DEFAULT_API_KEY).toBe('sk-legacy');
        });

        it('maps NANO_GPT_API_BASE_URL to AI_DEFAULT_API_BASE_URL when new name is absent', () => {
            const result = applyLegacyShim({
                NANO_GPT_API_KEY: 'sk-legacy',
                NANO_GPT_API_BASE_URL: 'https://nano-gpt.com/api/v1',
            });
            expect(result.AI_DEFAULT_API_KEY).toBe('sk-legacy');
            expect(result.AI_DEFAULT_API_BASE_URL).toBe('https://nano-gpt.com/api/v1');
        });

        it('maps NANO_GPT_MODEL and NANO_GPT_FLASH_MODEL when new names are absent', () => {
            const result = applyLegacyShim({
                NANO_GPT_API_KEY: 'sk-legacy',
                NANO_GPT_MODEL: 'moonshotai/kimi-k2.5:thinking',
                NANO_GPT_FLASH_MODEL: 'moonshotai/kimi-k2.5',
            });
            expect(result.AI_DEFAULT_MODEL).toBe('moonshotai/kimi-k2.5:thinking');
            expect(result.AI_DEFAULT_FLASH_MODEL).toBe('moonshotai/kimi-k2.5');
        });

        it('returns empty fields when no legacy env is present', () => {
            const result = applyLegacyShim({});
            expect(result.AI_DEFAULT_API_KEY).toBeUndefined();
            expect(result.AI_DEFAULT_API_BASE_URL).toBeUndefined();
            expect(result.AI_DEFAULT_MODEL).toBeUndefined();
            expect(result.AI_DEFAULT_FLASH_MODEL).toBeUndefined();
        });
    });

    describe('S5.2 — edge: new names win over legacy', () => {
        it('preserves AI_DEFAULT_API_KEY when both new and legacy are set', () => {
            const result = applyLegacyShim({
                AI_DEFAULT_API_KEY: 'sk-new',
                NANO_GPT_API_KEY: 'sk-old',
            });
            expect(result.AI_DEFAULT_API_KEY).toBe('sk-new');
        });

        it('preserves AI_DEFAULT_API_BASE_URL when both are set', () => {
            const result = applyLegacyShim({
                AI_DEFAULT_API_KEY: 'sk-new',
                AI_DEFAULT_API_BASE_URL: 'https://example.com/v1',
                NANO_GPT_API_BASE_URL: 'https://nano-gpt.com/api/v1',
            });
            expect(result.AI_DEFAULT_API_BASE_URL).toBe('https://example.com/v1');
        });
    });

    describe('deprecation warning fires exactly once per process', () => {
        beforeEach(() => {
            __resetLegacyShimWarningForTests();
        });

        it('emits console.warn only on the first call that has legacy vars', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            try {
                applyLegacyShim({ NANO_GPT_API_KEY: 'k1' });
                applyLegacyShim({ NANO_GPT_API_KEY: 'k2' });
                applyLegacyShim({ NANO_GPT_API_KEY: 'k3' });
                const deprecationCalls = warnSpy.mock.calls.filter((args) =>
                    String(args[0] ?? '').includes('DEPRECATION')
                );
                expect(deprecationCalls).toHaveLength(1);
            } finally {
                warnSpy.mockRestore();
            }
        });

        it('warns with a pointer to docs/MIGRATION.md', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            try {
                applyLegacyShim({ NANO_GPT_API_KEY: 'k' });
                const flat = warnSpy.mock.calls
                    .map((args) => args.map((a) => String(a)).join(' '))
                    .join('\n');
                expect(flat).toContain('docs/MIGRATION.md');
            } finally {
                warnSpy.mockRestore();
            }
        });

        it('does not warn when only new names are set', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            try {
                applyLegacyShim({ AI_DEFAULT_API_KEY: 'sk-new' });
                const deprecationCalls = warnSpy.mock.calls.filter((args) =>
                    String(args[0] ?? '').includes('DEPRECATION')
                );
                expect(deprecationCalls).toHaveLength(0);
            } finally {
                warnSpy.mockRestore();
            }
        });
    });

    describe('deprecation date is the single source of truth', () => {
        it('exports AI_LEGACY_SHIM_DEPRECATION_DATE = 2026-09-01', () => {
            expect(AI_LEGACY_SHIM_DEPRECATION_DATE).toBe('2026-09-01');
        });

        it('shim file still exists (deadline is enforced, not just promised)', () => {
            expect(fs.existsSync(SHIM_PATH)).toBe(true);
        });
    });

    describe('S5.3 — CI guard script', () => {
        const SCRIPT_PATH = path.join(
            __dirname,
            '..',
            'scripts',
            'check-legacy-shim.js'
        );

        function runGuard(env: Record<string, string> = {}): { status: number; stderr: string; stdout: string } {
            try {
                const stdout = execFileSync('node', [SCRIPT_PATH], {
                    env: { ...process.env, ...env },
                    encoding: 'utf-8',
                    stdio: ['ignore', 'pipe', 'pipe'],
                });
                return { status: 0, stdout, stderr: '' };
            } catch (err) {
                const e = err as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string };
                return {
                    status: e.status ?? 1,
                    stdout: typeof e.stdout === 'string' ? e.stdout : e.stdout?.toString() ?? '',
                    stderr: typeof e.stderr === 'string' ? e.stderr : e.stderr?.toString() ?? '',
                };
            }
        }

        it('exits 0 today (deprecation date is in the future)', () => {
            const result = runGuard();
            expect(result.status).toBe(0);
        });

        it('exits 1 with a past-date override and stderr contains the date', () => {
            const result = runGuard({ AI_LEGACY_SHIM_OVERRIDE_DATE: '2020-01-01' });
            expect(result.status).toBe(1);
            expect(result.stderr).toContain('2020-01-01');
            expect(result.stderr).toContain('docs/MIGRATION.md');
        });

        it('guard script is plain JavaScript (no TS compilation needed)', () => {
            expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
            const content = fs.readFileSync(SCRIPT_PATH, 'utf-8');
            expect(content).toMatch(/^#![^\n]*node/);
            expect(content).not.toContain('import ');
            expect(content).toContain('AI_LEGACY_SHIM_DEPRECATION_DATE');
        });
    });
});
