import {
    EXPORT_PALETTES,
    buildEntryImage,
    entryImageFileName,
    escapeXml,
    wrapText,
} from '@/utils/entryImage';

const LIGHT = EXPORT_PALETTES.light;

function build(text: string, dateLabel = '8 Nov 2026', theme: 'light' | 'dark' = 'light') {
    return buildEntryImage({ entryText: text, dateLabel, palette: EXPORT_PALETTES[theme] });
}

describe('escapeXml', () => {
    it('escapes the characters that would break the file', () => {
        expect(escapeXml('Tom & Jerry <tag>')).toBe('Tom &amp; Jerry &lt;tag&gt;');
    });

    it('escapes quotes so an apostrophe cannot close an attribute', () => {
        expect(escapeXml(`it's "quoted"`)).toBe('it&apos;s &quot;quoted&quot;');
    });
});

describe('wrapText', () => {
    it('keeps a short line whole', () => {
        expect(wrapText('A quiet morning', 34)).toEqual(['A quiet morning']);
    });

    it('breaks a long line at a word boundary', () => {
        const lines = wrapText('one two three four five six', 12);
        expect(lines.every((line) => line.length <= 12)).toBe(true);
        expect(lines.join(' ')).toBe('one two three four five six');
    });

    it('leaves a long word intact rather than chopping it', () => {
        expect(wrapText('supercalifragilistic', 5)).toEqual(['supercalifragilistic']);
    });

    it('keeps paragraph breaks as blank lines', () => {
        expect(wrapText('first\n\nsecond', 34)).toEqual(['first', '', 'second']);
    });

    it('does not lose a word at a break', () => {
        const source = 'the quick brown fox jumps over the lazy dog';
        expect(wrapText(source, 10).join(' ')).toBe(source);
    });
});

describe('buildEntryImage', () => {
    it('produces a complete svg document', () => {
        const svg = build('A slow morning with coffee.');
        expect(svg.startsWith('<?xml')).toBe(true);
        expect(svg).toContain('<svg xmlns=');
        expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    });

    it('carries the writer text', () => {
        expect(build('A slow morning with coffee.')).toContain('A slow morning with coffee.');
    });

    it('shows the day in uppercase', () => {
        expect(build('hi', '8 Nov 2026')).toContain('8 NOV 2026');
    });

    it('escapes text instead of breaking the markup', () => {
        const svg = build('Tom & Jerry <3');
        expect(svg).toContain('Tom &amp; Jerry &lt;3');
        expect(svg).not.toContain('Tom & Jerry <3');
    });

    it('grows taller for longer entries', () => {
        const shortHeight = Number(build('short').match(/height="(\d+)"/)?.[1]);
        const longHeight = Number(build('word '.repeat(200)).match(/height="(\d+)"/)?.[1]);
        expect(longHeight).toBeGreaterThan(shortHeight);
    });

    it('caps a very long entry instead of making an unreadable strip', () => {
        const svg = build('word '.repeat(2000));
        const height = Number(svg.match(/height="(\d+)"/)?.[1]);
        expect(height).toBeLessThan(4000);
        expect(svg).toContain('…');
    });

    it('uses the requested palette', () => {
        expect(build('hi', '8 Nov 2026', 'dark')).toContain(EXPORT_PALETTES.dark.text);
        expect(build('hi', '8 Nov 2026', 'light')).toContain(LIGHT.text);
    });

    it('draws no black fallback border', () => {
        const svg = build('hi');
        expect(svg).toContain(`stroke="${LIGHT.hairline}"`);
        expect(svg).not.toContain('stroke="#000000"');
    });
});

describe('entryImageFileName', () => {
    it('names the file after the day', () => {
        expect(entryImageFileName('8 Nov 2026')).toBe('blackrose-8-Nov-2026.svg');
    });

    it('strips characters a file system dislikes', () => {
        expect(entryImageFileName('8/11/2026')).toBe('blackrose-8-11-2026.svg');
    });

    it('still produces a usable name from an empty day', () => {
        expect(entryImageFileName('  ')).toBe('blackrose-entry.svg');
    });
});
