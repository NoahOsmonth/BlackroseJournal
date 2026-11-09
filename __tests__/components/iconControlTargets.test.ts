import fs from 'fs';
import path from 'path';

/**
 * Round 56 swept ten routes plus entry detail and chat. The chat composer's two
 * icon-only controls measured 22x22 with hitSlop 8 - a 38px target, under the
 * 44px minimum, on the two most-tapped controls in the app. A 22px glyph needs
 * 12px of slop per side to reach 46px; 8 only reaches 38.
 *
 * The rule pinned here: an icon-only control under 32px must carry hitSlop of at
 * least 12, because slop is the only thing standing between a 22px glyph and a
 * miss.
 */
const ROOT = path.resolve(__dirname, '..', '..');

function read(rel: string): string {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/** Every <Pressable ...> opening tag, arrow-function '>' included. */
function pressableTags(source: string): string[] {
    return source.match(/<Pressable\b(?:(?:=>)|[^>])*>/gs) ?? [];
}

describe('icon-only controls reach 44px through slop (Kaneo #97)', () => {
    it('the chat composer photo and voice controls carry 12px of slop', () => {
        const tags = pressableTags(read('components/chat/ChatComposerBar.tsx'));
        const photo = tags.filter((tag) => tag.includes('Attach a photo'));
        const voice = tags.filter((tag) => tag.includes('voice.label'));
        expect(photo).toHaveLength(1);
        expect(voice).toHaveLength(1);
        for (const tag of [...photo, ...voice]) {
            // Round 70 (#111): a real 44x44 box beats slop, which only extends the
            // touch area invisibly and can overlap a neighbour. Either satisfies
            // the rule; slop is no longer required once the box itself is 44px.
            const slop = Number((tag.match(/hitSlop=\{(\d+)\}/) || [])[1]);
            const boxIs44 = /h-11 w-11/.test(tag) || /w-11 h-11/.test(tag);
            expect(boxIs44 || slop >= 12).toBe(true);
        }
    });

    it('the goals add line and the persona pill are 44px tall', () => {
        const addLine = pressableTags(read('app/goals.tsx')).filter((tag) =>
            tag.includes('Add goal or habit'),
        );
        // One is the 40px icon button (slop 8 = 56px); the other is the text line.
        const textLine = addLine.filter((tag) => !tag.includes('h-10 w-10'));
        expect(textLine).toHaveLength(1);
        expect(textLine[0]).toContain('min-h-11');

        const pill = pressableTags(read('components/Header.tsx')).filter((tag) =>
            tag.includes('Choose persona'),
        );
        expect(pill).toHaveLength(1);
        expect(pill[0]).toContain('min-h-11');
    });

    it('the thinking toggle carries slop wide enough for a 24px row', () => {
        const tags = pressableTags(read('components/ai/AgentToolActivity.tsx')).filter((tag) =>
            tag.includes('Hide thinking'),
        );
        expect(tags).toHaveLength(1);
        const slop = Number((tags[0].match(/hitSlop=\{(\d+)\}/) || [])[1]);
        expect(slop).toBeGreaterThanOrEqual(10);
    });
});
