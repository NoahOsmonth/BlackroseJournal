import fs from 'fs';
import path from 'path';

/**
 * NativeWind drops a **function** `style` on a `className`-interop'd component.
 *
 * `cssInterop(Pressable, { className: 'style' })` merges through
 * `assignToTarget` with `objectMergeStyle: 'toArray'`, but that branch is only
 * taken when `typeof target === 'object'`
 * (`react-native-css-interop/dist/shared.js:96-120`). A `style={({ pressed }) => …}`
 * is a function, so it falls to the final `else` — `parent.style = value` — and
 * the function is discarded whole, taking every declaration inside it.
 *
 * That shipped twice: the Explore composer's `Keep it` CTA rendered with no fill
 * at all (its label is inked with the page colour, so the button was invisible),
 * and the chat composer's send disc lost its fill, leaving a near-paper glyph on
 * the paper surface. Jest cannot see either: `props.style` under the RNTL renderer
 * is already the resolved array, so a test that flattens `props.style` passes
 * while the browser paints nothing.
 *
 * The rule this guards: **a style that carries a colour must not be a function.**
 * Pressed feedback is what the function form is for, and it is recoverable with
 * `onPressIn` / `onPressOut` plus a state flag — the two fixed call sites do that.
 */

const SOURCE_DIRS = ['components', 'app'];

/** Files under the given dirs, recursively, as repo-relative posix paths. */
function sourceFiles(...dirs: string[]): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (/\.tsx?$/.test(entry.name)) out.push(full);
        }
    };
    dirs.forEach(walk);
    return out;
}

/**
 * The function-style block, up to its closing `]`/`}`. Matching the whole block
 * (not just the first line) is what makes the check see a colour declared on a
 * later line of a multi-line style.
 */
const FUNCTION_STYLE_RE = /style=\{\([^)]*\)\s*=>\s*\[?([\s\S]{0,400}?)\]\s*\}/g;

/** A colour declaration anywhere in the captured block. */
const COLOUR_RE = /(backgroundColor|borderColor|color)\s*:/;

describe('NativeWind function-style guard', () => {
    const files = sourceFiles(...SOURCE_DIRS);

    it('scans a non-trivial number of source files', () => {
        // A silently-empty scan would make every assertion below vacuous.
        expect(files.length).toBeGreaterThan(100);
    });

    it('never puts a colour inside a Pressable function style', () => {
        const offenders: string[] = [];

        for (const file of files) {
            const source = fs.readFileSync(file, 'utf-8');
            FUNCTION_STYLE_RE.lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = FUNCTION_STYLE_RE.exec(source)) !== null) {
                const block = match[1] ?? '';
                if (!COLOUR_RE.test(block)) continue;
                const line = source.slice(0, match.index).split('\n').length;
                offenders.push(`${file}:${line}`);
            }
        }

        expect(offenders).toEqual([]);
    });

    it('detects the pattern it claims to detect', () => {
        // Sabotage in miniature: the regex must match the shape that shipped.
        const bad = 'style={({ pressed }) => [\n  { backgroundColor: fill, opacity: pressed ? 0.7 : 1 },\n]}';
        FUNCTION_STYLE_RE.lastIndex = 0;
        const match = FUNCTION_STYLE_RE.exec(bad);
        expect(match).not.toBeNull();
        expect(COLOUR_RE.test(match?.[1] ?? '')).toBe(true);

        // And it must NOT match the opacity-only form, which has no colour to lose.
        const ok = 'style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}';
        FUNCTION_STYLE_RE.lastIndex = 0;
        const okMatch = FUNCTION_STYLE_RE.exec(ok);
        expect(okMatch).not.toBeNull();
        expect(COLOUR_RE.test(okMatch?.[1] ?? '')).toBe(false);
    });
});
