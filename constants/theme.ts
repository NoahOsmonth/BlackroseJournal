/**
 * Theme and Typography Configuration — Blackrose.
 *
 * ## Typography
 * - Plus Jakarta Sans across the app (body, chat chrome, controls).
 * - Playfair Display for the single serif moment per screen (title/date/section).
 *
 * ## Color token strategy
 * - Locked hexes live in `constants/blackrose.ts` (the palette table) and are
 *   projected onto NativeWind tokens in `tailwind.config.js`.
 * - Components use theme tokens — never raw hex. `__tests__/constants/`
 *   `blackrosePalette.test.ts` fails when a consumer drifts from the table.
 * - Both schemes are first-class: every surface and every `<Text>` pairs a
 *   light and a `dark:` token (AGENTS rule 1).
 *
 * The Color Studio API (presets/slots/runtime vars) lives in
 * `constants/colorThemes.ts` and is re-exported here for backwards
 * compatibility with existing imports.
 *
 * See `docs/plans/blackrose-design-rewrite.md` §2.
 */

import { Platform } from 'react-native';

import {
    BLACKROSE_GRAPH_FAMILIES,
    BLACKROSE_PALETTE,
    type GraphFamily,
    type GraphFamilyShades,
} from '@/constants/blackrose';
import { AppBackgroundColors } from '@/constants/colorThemes';

export {
    AppBackgroundColors,
    BLACKROSE_COLOR_THEME_COLORS,
    COLOR_THEME_PRESETS,
    DEFAULT_COLOR_THEME,
    DEFAULT_COLOR_THEME_COLORS,
    LEGACY_ROSEBUD_COLOR_THEME_COLORS,
    QUICK_PICK_COLORS,
    colorThemeFromPreset,
    colorThemeToNativeWindVars,
    getColorThemeSlotPartner,
    isColorThemeLightSlot,
    isHexColor,
    normalizeHexColor,
    updateColorThemeSlot,
} from '@/constants/colorThemes';
export type {
    ColorTheme,
    ColorThemeColors,
    ColorThemePreset,
    ColorThemePresetId,
    ColorThemeSlot,
} from '@/constants/colorThemes';

export { BLACKROSE_GRAPH_FAMILIES, BLACKROSE_PALETTE, BANNED_BRAND_HEXES } from '@/constants/blackrose';
export type { BlackroseScheme, GraphFamily, GraphFamilyShades } from '@/constants/blackrose';

/**
 * Accent (bone) — the interactive mark color. Use `TintColors` for JS values
 * handed to icon libraries; use the `primary` / `bone` Tailwind tokens in JSX.
 */
export const TintColors = {
    light: BLACKROSE_PALETTE.light.accent,
    dark: BLACKROSE_PALETTE.dark.accent,
} as const;

/**
 * Persona marks are the muted-rose family (third graph family), never pink
 * lotus. Line rose silhouettes are drawn from these plus the ink tokens.
 */
export const PersonaColors = {
    rose: BLACKROSE_PALETTE.light.roseMuted,
    roseLight: BLACKROSE_PALETTE.dark.roseMuted,
    roseDeep: BLACKROSE_GRAPH_FAMILIES.light.rose.deep,
    roseDeepDark: BLACKROSE_GRAPH_FAMILIES.dark.rose.deep,
} as const;

/**
 * Chat identity: companion text is bone, user text is primary ink. The old
 * chat-blue assistant color is intentionally gone (banned as brand chrome).
 */
export const ChatColors = {
    accentLight: BLACKROSE_PALETTE.light.accent,
    accentDark: BLACKROSE_PALETTE.dark.accent,
    activeDark: BLACKROSE_PALETTE.dark.accentStrong,
    userTextLight: BLACKROSE_PALETTE.light.text,
    userTextDark: BLACKROSE_PALETTE.dark.text,
} as const;

/** Hex for MaterialIcons status glyphs — must match tailwind `tool-*` tokens. */
export const ToolStatusColors = {
    okLight: BLACKROSE_PALETTE.light.ok,
    okDark: BLACKROSE_PALETTE.dark.ok,
    errorLight: BLACKROSE_PALETTE.light.danger,
    errorDark: BLACKROSE_PALETTE.dark.danger,
    warnLight: BLACKROSE_PALETTE.light.roseMuted,
    warnDark: BLACKROSE_PALETTE.dark.roseMuted,
    idleLight: BLACKROSE_PALETTE.light.text2,
    idleDark: BLACKROSE_PALETTE.dark.text2,
} as const;

/**
 * Six memory layers, three families, two shades each. The rainbow set is
 * banned; differentiation comes from family + shade.
 */
export const MemoryLayerColors = {
    episodic: BLACKROSE_GRAPH_FAMILIES.dark.bone.base,
    semantic: BLACKROSE_GRAPH_FAMILIES.dark.sage.base,
    profile: BLACKROSE_GRAPH_FAMILIES.dark.rose.base,
    procedural: BLACKROSE_GRAPH_FAMILIES.dark.sage.deep,
    note: BLACKROSE_GRAPH_FAMILIES.dark.bone.deep,
    working: BLACKROSE_GRAPH_FAMILIES.dark.rose.deep,
} as const;

/** Family + shade for a layer, per scheme (graph filters, node sheet, atoms). */
export function memoryLayerShades(
    layer: keyof typeof MemoryLayerColors,
    scheme: 'light' | 'dark',
): GraphFamilyShades {
    const families = BLACKROSE_GRAPH_FAMILIES[scheme];
    const mapping: Record<keyof typeof MemoryLayerColors, { family: GraphFamily; shade: keyof GraphFamilyShades }> = {
        episodic: { family: 'bone', shade: 'base' },
        semantic: { family: 'sage', shade: 'base' },
        profile: { family: 'rose', shade: 'base' },
        procedural: { family: 'sage', shade: 'deep' },
        note: { family: 'bone', shade: 'deep' },
        working: { family: 'rose', shade: 'deep' },
    };
    const { family, shade } = mapping[layer];
    return { base: families[family].base, deep: families[family][shade] } as GraphFamilyShades;
}

export const Colors = {
    light: {
        text: BLACKROSE_PALETTE.light.text,
        background: AppBackgroundColors.light,
        surface: BLACKROSE_PALETTE.light.surface,
        tint: TintColors.light,
        icon: BLACKROSE_PALETTE.light.text2,
        tabIconDefault: BLACKROSE_PALETTE.light.text2,
        tabIconSelected: TintColors.light,
        primary: TintColors.light,
        primaryDark: BLACKROSE_GRAPH_FAMILIES.light.bone.deep,
    },
    dark: {
        text: BLACKROSE_PALETTE.dark.text,
        background: AppBackgroundColors.dark,
        surface: BLACKROSE_PALETTE.dark.surface,
        tint: TintColors.dark,
        icon: BLACKROSE_PALETTE.dark.text2,
        tabIconDefault: BLACKROSE_PALETTE.dark.text2,
        tabIconSelected: TintColors.dark,
        primary: TintColors.dark,
        primaryDark: BLACKROSE_PALETTE.dark.accentStrong,
    },
};

export const theme = {
    colors: {
        background: Colors.dark.background,
        surface: Colors.dark.surface,
        text: Colors.dark.text,
        primary: Colors.light.primary,
        memoryLayers: MemoryLayerColors,
    },
} as const;

/**
 * Illustration colors for the Today ritual glyphs. Mapped onto the Blackrose
 * families: no pastel sky/water, no amber moon.
 */
export const TodayIconColors = {
    morningSkyLight: BLACKROSE_PALETTE.light.surface2,
    morningHillLight: BLACKROSE_GRAPH_FAMILIES.light.bone.deep,
    morningSmileLight: BLACKROSE_PALETTE.light.text,
    morningHillDark: BLACKROSE_GRAPH_FAMILIES.dark.bone.deep,
    eveningSkyLight: BLACKROSE_PALETTE.light.surface2,
    eveningMoonLight: BLACKROSE_PALETTE.light.accent,
    eveningMoonDark: BLACKROSE_PALETTE.dark.accent,
    eveningWaterLight: BLACKROSE_PALETTE.light.hairline,
    eveningWaterLineLight: BLACKROSE_PALETTE.light.text2,
    eveningWaterLineDark: BLACKROSE_PALETTE.dark.text2,
    eveningStarLight: BLACKROSE_PALETTE.light.accent,
} as const;

export const Fonts = Platform.select({
    ios: {
        /** iOS `UIFontDescriptorSystemDesignDefault` */
        sans: 'PlusJakartaSansRegular',
        /** iOS `UIFontDescriptorSystemDesignSerif` */
        serif: 'PlayfairDisplayRegular',
        /** iOS `UIFontDescriptorSystemDesignRounded` */
        rounded: 'ui-rounded',
        /** iOS `UIFontDescriptorSystemDesignMonospaced` */
        mono: 'ui-monospace',
    },
    default: {
        sans: 'PlusJakartaSansRegular',
        serif: 'PlayfairDisplayRegular',
        rounded: 'normal',
        mono: 'monospace',
    },
    web: {
        sans: "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        serif: "'Playfair Display', Georgia, 'Times New Roman', serif",
        rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
        mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    },
});
