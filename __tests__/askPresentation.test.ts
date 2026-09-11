import fs from 'fs';
import path from 'path';

/**
 * Ask + auth presentation law (plan §4, concepts `black-rose-ask.png` /
 * `black-rose-login.png`): one serif moment per screen, hairline borders in
 * place of the pre-rewrite gray cards, and no orange CTA fill.
 *
 * Source-level guards: they fail if a future edit reintroduces the Rosebud-era
 * chrome on either surface.
 */

const read = (...segments: string[]) =>
    fs.readFileSync(path.join(process.cwd(), ...segments), 'utf-8');

const AUTH_FILES = [
    ['app', '(auth)', 'login.tsx'],
    ['app', '(auth)', 'signup.tsx'],
    ['app', '(auth)', 'forgot-password.tsx'],
    ['components', 'auth', 'AuthPrimitives.tsx'],
] as const;

const LEGACY_CHROME = [
    'bg-primary',
    'text-primary',
    'border-primary',
    'text-white',
    'rounded-xl',
    'bg-yellow-300',
    'shadow-sm',
];

describe('Ask presentation', () => {
    const ask = read('app', 'ask-rosebud.tsx');
    const rows = read('components', 'ask', 'AskMessageRow.tsx');

    it('titles the screen Ask and drops the pre-rewrite range label', () => {
        expect(ask).toContain('Ask');
        expect(ask).not.toContain('Ask Rosebud');
        expect(ask).not.toContain('TIME_RANGE_LABELS[timeRange]} entries');
        expect(ask).not.toContain('Analyzing');
    });

    it('draws the range control as an outline pill, never a chip or bare link', () => {
        expect(ask).toContain('rounded-full border border-hairline-light');
        expect(ask).toContain('dark:border-hairline-dark');
        expect(ask).toContain('expand-more');
    });

    it('keeps the companion beside a rail with the diamond ornament', () => {
        expect(rows).toContain('rotate-45');
        expect(rows).toContain('bg-bone-light dark:bg-bone-dark');
        expect(rows).toContain('PlayfairDisplayRegular');
        expect(rows).toContain('bg-surface-2-light px-4 py-3 dark:bg-surface-2-dark');
    });

    it('uses hairline tokens that exist, not the missing border-border-* pair', () => {
        [ask, rows].forEach((content) => {
            expect(content).not.toContain('border-border-');
            expect(content).not.toContain('dark:bg-primary');
            expect(content).not.toContain('text-gray-');
            expect(content).not.toContain('text-black');
        });
    });

    it('suggests questions without the uppercase label block', () => {
        expect(ask).not.toContain('SUGGESTED QUESTIONS');
        expect(ask).not.toContain('Suggested Questions');
        expect(ask).toContain('RoseMark');
    });
});

describe('auth presentation', () => {
    it('never fills a CTA with the pre-rewrite orange', () => {
        AUTH_FILES.forEach((segments) => {
            const content = read(...segments);
            const code = content
                .split('\n')
                .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('/'))
                .join('\n');
            LEGACY_CHROME.forEach((token) => {
                expect(`${segments.join('/')}: ${code}`).not.toContain(token);
            });
        });
    });

    it('sets the auth CTA in serif on a bone fill with scheme-aware ink', () => {
        const primitives = read('components', 'auth', 'AuthPrimitives.tsx');
        expect(primitives).toContain('bg-bone-light dark:bg-bone-dark');
        expect(primitives).toContain('text-on-bone-light dark:text-on-bone-dark');
        expect(primitives).toContain('PlayfairDisplayRegular');
    });

    it('draws the password reveal as an icon, never emoji', () => {
        const primitives = read('components', 'auth', 'AuthPrimitives.tsx');
        expect(primitives).toContain("name={reveal ? 'visibility-off' : 'visibility'}");
        expect(primitives).not.toContain('🙈');
        expect(primitives).not.toContain('👁');
    });

    it('uses hairline borders and control radii on auth inputs', () => {
        const primitives = read('components', 'auth', 'AuthPrimitives.tsx');
        expect(primitives).toContain('rounded-control');
        expect(primitives).toContain('border-hairline-light dark:border-hairline-dark');
    });
});
