import fs from 'fs';
import path from 'path';

/**
 * Chat presentation law (plan §4): both chat surfaces share one look —
 * user slip on the right with no bubble tail, companion paragraph beside a
 * bone left rule, complete prose (no typewriter), bone thinking dots, the
 * “Write what's true…” composer, outline footer actions, and the mistake line.
 *
 * These are source-level guards: they fail if a future edit forks the two
 * surfaces or reintroduces the pre-rewrite chat chrome.
 */

const read = (...segments: string[]) =>
    fs.readFileSync(path.join(process.cwd(), ...segments), 'utf-8');

const CHAT_FILES = [
    ['components', 'ChatMessage.tsx'],
    ['components', 'InlineTypingInput.tsx'],
    ['components', 'FooterActions.tsx'],
    ['components', 'intentions', 'IntentionChatMessage.tsx'],
    ['components', 'intentions', 'IntentionChatBody.tsx'],
] as const;

const LEGACY_CHAT_CHROME = [
    'bg-slate-',
    'dark:bg-slate-',
    'border-slate-',
    'bg-blue-100',
    'bg-gray-100',
    'bg-yellow-300',
    'text-white',
    'shadow-sm',
];

describe('chat presentation', () => {
    it('gives the companion a bone left rule and the user a right-aligned slip', () => {
        const chatMessage = read('components', 'ChatMessage.tsx');
        expect(chatMessage).toContain('bg-bone-light dark:bg-bone-dark');
        expect(chatMessage).toContain('bg-surface-2-light px-4 py-3 dark:bg-surface-2-dark');

        const intentionMessage = read('components', 'intentions', 'IntentionChatMessage.tsx');
        expect(intentionMessage).toContain('bg-bone-light dark:bg-bone-dark');
        expect(intentionMessage).toContain('bg-surface-2-light px-4 py-3 dark:bg-surface-2-dark');
        expect(intentionMessage).toContain('items-end');
    });

    it('ships no bubble tails, letter-by-letter typewriter, or legacy chat chrome', () => {
        CHAT_FILES.forEach((segments) => {
            const content = read(...segments);
            const code = content
                .split('\n')
                .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
                .join('\n');
            LEGACY_CHAT_CHROME.forEach((token) => {
                expect(`${segments.join('/')}: ${code}`).not.toContain(token);
            });
            // A per-character reveal is the thing the plan bans.
            expect(code).not.toMatch(/displayedText\.slice\(0,\s*index\)/);
        });
    });

    it('keeps one composer prompt on both surfaces', () => {
        const composer = read('components', 'InlineTypingInput.tsx');
        expect(composer).toContain("placeholder = \"Write what's true…\"");
        expect(composer).toContain('accessibilityLabel="Send message"');

        expect(read('app', 'chat.tsx')).toContain('placeholder="Write what\'s true…"');
        expect(read('components', 'intentions', 'IntentionChatComposerBar.tsx'))
            .toContain('placeholder="Write what\'s true…"');
    });

    it('keeps the companion mistake line where the design keeps it', () => {
        // `black-rose-chat.png` gives the freeform footer no honesty line: the verbs
        // float above the writing slip. The intention footer has no concept and
        // keeps its disclaimer beside the volume control.
        expect(read('app', 'chat.tsx')).not.toContain('can make mistakes');
        expect(read('components', 'intentions', 'IntentionChatFooter.tsx'))
            .toContain('Blackrose can make mistakes.');
    });

    it('renders thinking as three bone dots with a caption, never a bare spinner word', () => {
        const indicator = read('components', 'ui', 'TypingIndicator.tsx');
        expect(indicator).toContain("text-bone-light dark:text-bone-dark");
        expect(indicator).toContain('label');
        expect(indicator).toContain('DOTS.map');
    });

    it('gives the footer outline actions rather than a filled brand button', () => {
        const footer = read('components', 'FooterActions.tsx');
        expect(footer).toContain('border-hairline-light');
        expect(footer).toContain('rounded-control');
        expect(footer).not.toContain('bg-primary');
        expect(footer).toContain('Go deeper');
        expect(footer).toContain('Finish entry');
    });

    it('names the companion Blackrose in chat headers by default', () => {
        expect(read('components', 'Header.tsx')).toContain("personaName ?? 'Blackrose'");
        expect(read('app', 'chat.tsx')).toContain("activePersona?.name ?? 'Blackrose'");
        expect(read('app', 'intentions', 'chat.tsx')).toContain("activePersona?.name ?? 'Blackrose'");
    });
});
