/**
 * Blackrose palette — the single source of truth for the design lock.
 *
 * Every hex below is the *only* place it may be written. Tailwind tokens
 * (`tailwind.config.js`), runtime tokens (`constants/theme.ts`) and the
 * Color Studio presets (`constants/colorThemes.ts`) all derive from here,
 * and `__tests__/constants/blackrosePalette.test.ts` fails if a consumer
 * drifts from this table.
 *
 * Plan: docs/plans/blackrose-design-rewrite.md §2
 * Concepts: example-design/concepts/generated/
 *
 * Banned as brand chrome (must never appear as a token default):
 *   #FF9F0A orange, #E91E63 pink, #38BDF8/#3B82F6 chat blue as assistant
 *   identity, flame streak red-orange, rainbow memory-layer fills.
 */

export interface BlackroseScheme {
    /** App void / paper. */
    readonly bg: string;
    /** Cards, sheets. */
    readonly surface: string;
    /** Nested surfaces and slips (chat user slip, chips). */
    readonly surface2: string;
    /** Dividers, borders, rules. */
    readonly hairline: string;
    /** Primary ink. */
    readonly text: string;
    /** Secondary ink (labels, meta). */
    readonly text2: string;
    /** Bone accent — fills, rules, interactive marks. */
    readonly accent: string;
    /** High-contrast companion to `accent` — text/icons on the void. */
    readonly accentStrong: string;
    /** Sage — done / unlocked / positive. */
    readonly ok: string;
    /** Destructive only. */
    readonly danger: string;
    /** Third memory family: muted rose (personas, rose family). */
    readonly roseMuted: string;
}

/**
 * Muted-rose family is derived, not part of the locked table: the plan caps
 * the graph at three families (bone, sage, muted rose), so the third family
 * needs one rose that reads as quiet on both void and paper.
 */
export const BLACKROSE_PALETTE: { readonly dark: BlackroseScheme; readonly light: BlackroseScheme } = {
    dark: {
        bg: '#0C0C0E',
        surface: '#151518',
        surface2: '#1A1A1E',
        hairline: '#2C2A26',
        text: '#EDE8E0',
        text2: '#8A8580',
        accent: '#C9C2B6',
        accentStrong: '#EDE8E0',
        ok: '#7A9E7E',
        danger: '#C97B7B',
        roseMuted: '#C4A0A6',
    },
    light: {
        bg: '#F4F1EB',
        surface: '#FFFDF9',
        surface2: '#EDE8DF',
        hairline: '#E2DCD2',
        text: '#1C1917',
        text2: '#6B6560',
        accent: '#5C564C',
        accentStrong: '#1C1917',
        ok: '#4F6F52',
        danger: '#9B3A3A',
        roseMuted: '#8A5F68',
    },
} as const;

export type GraphFamily = 'bone' | 'sage' | 'rose';

export interface GraphFamilyShades {
    /** Dominant shade for the family's first layer. */
    readonly base: string;
    /** Second shade so two layers of one family stay distinguishable. */
    readonly deep: string;
}

/**
 * Memory-graph layer palette: three families, two shades each. Six layers map
 * onto six shades — differentiation without a rainbow.
 */
export const BLACKROSE_GRAPH_FAMILIES: {
    readonly dark: Record<GraphFamily, GraphFamilyShades>;
    readonly light: Record<GraphFamily, GraphFamilyShades>;
} = {
    dark: {
        bone: { base: BLACKROSE_PALETTE.dark.accent, deep: '#A79E8F' },
        sage: { base: BLACKROSE_PALETTE.dark.ok, deep: '#5F8065' },
        rose: { base: BLACKROSE_PALETTE.dark.roseMuted, deep: '#A4808A' },
    },
    light: {
        bone: { base: BLACKROSE_PALETTE.light.accent, deep: '#7A7266' },
        sage: { base: BLACKROSE_PALETTE.light.ok, deep: '#3D5741' },
        rose: { base: BLACKROSE_PALETTE.light.roseMuted, deep: '#6E474F' },
    },
} as const;

/** Banned brand hexes — asserted absent from token defaults by the guard test. */
export const BANNED_BRAND_HEXES: readonly string[] = [
    '#FF9F0A',
    '#FFB340',
    '#E91E63',
    '#38BDF8',
    '#3B82F6',
    '#60A5FA',
] as const;
