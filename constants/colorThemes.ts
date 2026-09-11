/**
 * Color Studio: presets, slots, and the runtime-variable bridge.
 *
 * Default is **Blackrose** (`BLACKROSE_COLOR_THEME_COLORS`). Legacy presets are
 * kept as non-default accent choices for rollback; they share the Blackrose
 * neutrals (void/paper, ink, secondary ink, user slip) and differ only in the
 * accent + companion text color, so every preset stays in the quiet literary
 * language. See `constants/blackrose.ts` for the locked palette.
 */

import { BLACKROSE_PALETTE } from '@/constants/blackrose';

/**
 * App void / paper. Kept as a named export because the background is shared by
 * every preset — personalization changes the accent, never the paper.
 */
export const AppBackgroundColors = {
    light: BLACKROSE_PALETTE.light.bg,
    dark: BLACKROSE_PALETTE.dark.bg,
} as const;

/** Neutral slots shared by every preset (Blackrose ink on Blackrose paper). */
const SHARED_NEUTRALS = {
    appTextLight: BLACKROSE_PALETTE.light.text,
    appTextDark: BLACKROSE_PALETTE.dark.text,
    secondaryTextLight: BLACKROSE_PALETTE.light.text2,
    secondaryTextDark: BLACKROSE_PALETTE.dark.text2,
    chatUserTextLight: BLACKROSE_PALETTE.light.text,
    chatUserTextDark: BLACKROSE_PALETTE.dark.text,
    appBackgroundLight: AppBackgroundColors.light,
    appBackgroundDark: AppBackgroundColors.dark,
} as const;

export type ColorThemePresetId =
    | 'blackrose'
    | 'rosebud'
    | 'ocean'
    | 'forest'
    | 'plum'
    | 'sunset'
    | 'lavender'
    | 'mint'
    | 'mocha'
    | 'custom';

export type ColorThemeSlot =
    | 'accentLight'
    | 'accentDark'
    | 'appTextLight'
    | 'appTextDark'
    | 'secondaryTextLight'
    | 'secondaryTextDark'
    | 'chatUserTextLight'
    | 'chatUserTextDark'
    | 'chatAiTextLight'
    | 'chatAiTextDark'
    | 'appBackgroundLight'
    | 'appBackgroundDark';

export type ColorThemeColors = Record<ColorThemeSlot, string>;

export interface ColorTheme {
    readonly presetId: ColorThemePresetId;
    readonly colors: ColorThemeColors;
}

export interface ColorThemePreset extends ColorTheme {
    readonly presetId: Exclude<ColorThemePresetId, 'custom'>;
    readonly name: string;
}

/** Blackrose: bone accent on charcoal void / paper. The default. */
export const BLACKROSE_COLOR_THEME_COLORS: ColorThemeColors = {
    accentLight: BLACKROSE_PALETTE.light.accent,
    accentDark: BLACKROSE_PALETTE.dark.accent,
    chatAiTextLight: BLACKROSE_PALETTE.light.accent,
    chatAiTextDark: BLACKROSE_PALETTE.dark.accent,
    ...SHARED_NEUTRALS,
} as const;

/**
 * The pre-rewrite accent (amber) as a non-default legacy choice, so a user who
 * liked it can keep it. The old chat blue is deliberately NOT carried over —
 * assistant blue is banned brand chrome and the chat presentation no longer
 * keys off an accent color (bone rule + ink). Kept for one release only; see
 * plan §Phase 7.
 */
export const LEGACY_ROSEBUD_COLOR_THEME_COLORS: ColorThemeColors = {
    accentLight: '#FF9F0A',
    accentDark: '#FFB340',
    chatAiTextLight: '#FF9F0A',
    chatAiTextDark: '#FFB340',
    ...SHARED_NEUTRALS,
} as const;

/** Default theme = Blackrose. */
export const DEFAULT_COLOR_THEME_COLORS: ColorThemeColors = BLACKROSE_COLOR_THEME_COLORS;

export const DEFAULT_COLOR_THEME: ColorTheme = {
    presetId: 'blackrose',
    colors: DEFAULT_COLOR_THEME_COLORS,
} as const;

function preset(
    presetId: Exclude<ColorThemePresetId, 'custom'>,
    name: string,
    accentLight: string,
    accentDark: string,
): ColorThemePreset {
    return {
        presetId,
        name,
        colors: {
            accentLight,
            accentDark,
            chatAiTextLight: accentLight,
            chatAiTextDark: accentDark,
            ...SHARED_NEUTRALS,
        },
    };
}

export const COLOR_THEME_PRESETS: readonly ColorThemePreset[] = [
    {
        presetId: 'blackrose',
        name: 'Blackrose',
        colors: BLACKROSE_COLOR_THEME_COLORS,
    },
    preset('rosebud', 'Amber', LEGACY_ROSEBUD_COLOR_THEME_COLORS.accentLight, LEGACY_ROSEBUD_COLOR_THEME_COLORS.accentDark),
    preset('ocean', 'Ocean', '#2F6F8F', '#8FB8C9'),
    preset('forest', 'Forest', '#4F6F52', '#8FB68F'),
    preset('plum', 'Plum', '#6E4A5E', '#C0A2B4'),
    preset('sunset', 'Sunset', '#9B3A3A', '#D9A08C'),
    preset('lavender', 'Lavender', '#5A5480', '#B4AECE'),
    preset('mint', 'Mint', '#3D6B63', '#9CC4BB'),
    preset('mocha', 'Mocha', '#6B5642', '#C4AF97'),
] as const;

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function isHexColor(value: string): boolean {
    return HEX_COLOR_PATTERN.test(value);
}

export function normalizeHexColor(value: string): string | null {
    const trimmed = value.trim();
    const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    return isHexColor(withHash) ? withHash.toUpperCase() : null;
}

export function colorThemeFromPreset(presetId: ColorThemePresetId): ColorTheme {
    const found = COLOR_THEME_PRESETS.find((item) => item.presetId === presetId);
    return {
        presetId: found?.presetId ?? DEFAULT_COLOR_THEME.presetId,
        colors: { ...(found?.colors ?? DEFAULT_COLOR_THEME.colors) },
    };
}

export function updateColorThemeSlot(
    themeValue: ColorTheme,
    slot: ColorThemeSlot,
    value: string,
): ColorTheme | null {
    const normalized = normalizeHexColor(value);
    if (!normalized) {
        return null;
    }

    return {
        presetId: 'custom',
        colors: {
            ...themeValue.colors,
            [slot]: normalized,
        },
    };
}

export function getColorThemeSlotPartner(slot: ColorThemeSlot): ColorThemeSlot {
    if (slot.endsWith('Light')) {
        return slot.replace(/Light$/, 'Dark') as ColorThemeSlot;
    }
    if (slot.endsWith('Dark')) {
        return slot.replace(/Dark$/, 'Light') as ColorThemeSlot;
    }
    return slot;
}

export function isColorThemeLightSlot(slot: ColorThemeSlot): boolean {
    return slot.endsWith('Light');
}

/**
 * Curated quick-pick palette for the Color Studio picker. Leads with the
 * Blackrose accent family (bone, sage, muted rose) so the first row reads as
 * the app's own vocabulary, then keeps the wider hue set available.
 */
export const QUICK_PICK_COLORS: readonly string[] = [
    BLACKROSE_PALETTE.light.accent, // bone
    BLACKROSE_PALETTE.light.roseMuted, // muted rose
    BLACKROSE_PALETTE.light.ok, // sage
    '#7A7266', // stone
    '#6B5642', // mocha
    '#9B3A3A', // oxblood
    '#6E4A5E', // plum
    '#5A5480', // lavender
    '#4F6F8F', // slate blue
    '#3D6B63', // deep teal
    '#4A5D3A', // moss
    '#8A6A2F', // bronze
    '#A8623C', // rust
    '#5C564C', // bone deep
    '#475569', // slate
    '#1C1917', // ink
];

function hexToRgbTriplet(hex: string): string {
    const normalized = normalizeHexColor(hex) ?? '#000000';
    const value = normalized.slice(1);
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `${r} ${g} ${b}`;
}

/**
 * Maps theme slots onto the NativeWind custom properties consumed by
 * `tailwind.config.js` / `global.css`. Note the historical naming: the
 * unsuffixed property (`--color-user-text`, `--color-accent-blue`) carries the
 * *light-mode* value, the `-dark` property the dark-mode value.
 */
export function colorThemeToNativeWindVars(themeValue: ColorTheme): Record<string, string> {
    const colors = themeValue.colors;

    return {
        '--color-primary': hexToRgbTriplet(colors.accentLight),
        '--color-primary-dark': hexToRgbTriplet(colors.accentDark),
        '--color-text-light': hexToRgbTriplet(colors.appTextLight),
        '--color-text-dark': hexToRgbTriplet(colors.appTextDark),
        '--color-text-main-light': hexToRgbTriplet(colors.appTextLight),
        '--color-text-main-dark': hexToRgbTriplet(colors.appTextDark),
        '--color-text-primary-light': hexToRgbTriplet(colors.appTextLight),
        '--color-text-primary-dark': hexToRgbTriplet(colors.appTextDark),
        '--color-text-secondary-light': hexToRgbTriplet(colors.secondaryTextLight),
        '--color-text-secondary-dark': hexToRgbTriplet(colors.secondaryTextDark),
        '--color-subtext-light': hexToRgbTriplet(colors.secondaryTextLight),
        '--color-subtext-dark': hexToRgbTriplet(colors.secondaryTextDark),
        '--color-user-text': hexToRgbTriplet(colors.chatUserTextLight),
        '--color-user-text-dark': hexToRgbTriplet(colors.chatUserTextDark),
        '--color-accent-blue': hexToRgbTriplet(colors.chatAiTextLight),
        '--color-ai-text': hexToRgbTriplet(colors.chatAiTextDark),
        '--color-background-light': hexToRgbTriplet(colors.appBackgroundLight),
        '--color-background-dark': hexToRgbTriplet(colors.appBackgroundDark),
    };
}
