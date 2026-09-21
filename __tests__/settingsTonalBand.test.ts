import { BLACKROSE_PALETTE } from '../constants/blackrose';

/**
 * The Settings tonal bands (design variant E) are *derived* values, not entries
 * in the locked palette: `band-*` is the card surface mixed 72% toward the page
 * background. Because they are derived, they can silently drift if someone
 * retunes `surface` or `bg` in `constants/blackrose.ts` — the rows would keep
 * rendering, just with a band tone that no longer reads as a band.
 *
 * This guard recomputes the mix from the palette and asserts the Tailwind table
 * still matches. The same mechanism backs the 450-line design limit: the rule
 * is mechanical rather than aspirational.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tailwindConfig = require('../tailwind.config.js');

const BAND_MIX = 0.72;

function hexToRgb(hex: string): [number, number, number] {
    return [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
    ];
}

function toHex([r, g, b]: [number, number, number]): string {
    return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** `surface` mixed `p` toward `bg` — the band value used for even rows. */
function mixToward(surface: string, bg: string, p: number): string {
    const s = hexToRgb(surface);
    const b = hexToRgb(bg);
    return toHex([0, 1, 2].map((i) => p * s[i] + (1 - p) * b[i]) as [number, number, number]);
}

const tokens: Record<string, string> = tailwindConfig.theme.extend.colors;

describe('settings tonal band tokens', () => {
    it('matches the palette-derived mix in both schemes', () => {
        expect(tokens['band-light']).toBe(
            mixToward(BLACKROSE_PALETTE.light.surface, BLACKROSE_PALETTE.light.bg, BAND_MIX)
        );
        expect(tokens['band-dark']).toBe(
            mixToward(BLACKROSE_PALETTE.dark.surface, BLACKROSE_PALETTE.dark.bg, BAND_MIX)
        );
    });

    it('keeps the band distinct from both the page and the open-row surface', () => {
        (['light', 'dark'] as const).forEach((scheme) => {
            const band = tokens[`band-${scheme}`].toUpperCase();
            const bg = BLACKROSE_PALETTE[scheme].bg.toUpperCase();
            const surface = BLACKROSE_PALETTE[scheme].surface.toUpperCase();

            // A band that equals the page background would be invisible; one
            // that equals the surface would erase the open-row distinction.
            expect(band).not.toBe(bg);
            expect(band).not.toBe(surface);
        });
    });

    it('keeps the open-row surface token as the palette surface', () => {
        expect(tokens['surface-light'].toUpperCase()).toBe(BLACKROSE_PALETTE.light.surface);
        expect(tokens['surface-dark'].toUpperCase()).toBe(BLACKROSE_PALETTE.dark.surface);
    });
});
