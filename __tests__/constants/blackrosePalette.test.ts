import { BANNED_BRAND_HEXES, BLACKROSE_GRAPH_FAMILIES, BLACKROSE_PALETTE } from "../../constants/blackrose";
import {
    AppBackgroundColors,
    BLACKROSE_COLOR_THEME_COLORS,
    COLOR_THEME_PRESETS,
    DEFAULT_COLOR_THEME,
    LEGACY_ROSEBUD_COLOR_THEME_COLORS,
    MemoryLayerColors,
    ToolStatusColors,
} from "../../constants/theme";

/**
 * The design lock, expressed as tests.
 *
 * `constants/blackrose.ts` is the only file allowed to write these hexes;
 * everything else must project from it. These assertions are what make the
 * "token first" rule mechanical instead of aspirational.
 */

const LOCKED_TABLE = {
    dark: {
        bg: "#0C0C0E",
        surface: "#151518",
        surface2: "#1A1A1E",
        hairline: "#2C2A26",
        text: "#EDE8E0",
        text2: "#8A8580",
        accent: "#C9C2B6",
        accentStrong: "#EDE8E0",
        ok: "#7A9E7E",
        danger: "#C97B7B",
    },
    light: {
        bg: "#F4F1EB",
        surface: "#FFFDF9",
        surface2: "#EDE8DF",
        hairline: "#E2DCD2",
        text: "#1C1917",
        text2: "#6B6560",
        accent: "#5C564C",
        accentStrong: "#1C1917",
        ok: "#4F6F52",
        danger: "#9B3A3A",
    },
} as const;

function channel(hex: string, start: number): number {
    return parseInt(hex.slice(1 + start, 3 + start), 16) / 255;
}

/** sRGB relative luminance (WCAG 2.1). */
function luminance(hex: string): number {
    const lin = (value: number) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(channel(hex, 0)) + 0.7152 * lin(channel(hex, 2)) + 0.0722 * lin(channel(hex, 4));
}

function contrast(a: string, b: string): number {
    const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (lighter + 0.05) / (darker + 0.05);
}

describe("blackrose palette", () => {
    it("matches the design-lock table exactly", () => {
        (["dark", "light"] as const).forEach((scheme) => {
            Object.entries(LOCKED_TABLE[scheme]).forEach(([role, hex]) => {
                expect(BLACKROSE_PALETTE[scheme][role as keyof typeof LOCKED_TABLE.dark]).toBe(hex);
            });
        });
    });

    it("keeps the memory graph to three families and two shades each", () => {
        (["dark", "light"] as const).forEach((scheme) => {
            const families = BLACKROSE_GRAPH_FAMILIES[scheme];
            expect(Object.keys(families).sort()).toEqual(["bone", "rose", "sage"]);
            Object.values(families).forEach((shades) => {
                expect(shades.base).toMatch(/^#[0-9A-Fa-f]{6}$/);
                expect(shades.deep).toMatch(/^#[0-9A-Fa-f]{6}$/);
                expect(shades.base).not.toBe(shades.deep);
            });
        });
    });

    it("maps all six memory layers inside the three families", () => {
        const familyHexes = Object.values(BLACKROSE_GRAPH_FAMILIES.dark).flatMap((shades) => [
            shades.base,
            shades.deep,
        ]);
        Object.values(MemoryLayerColors).forEach((hex) => {
            expect(familyHexes).toContain(hex);
        });
        // Six layers, six distinct shades — no two layers collapse onto one color.
        expect(new Set(Object.values(MemoryLayerColors)).size).toBe(6);
    });

    it("never uses a banned brand hex for a family or layer fill", () => {
        const familyHexes = Object.values(BLACKROSE_GRAPH_FAMILIES).flatMap((families) =>
            Object.values(families).flatMap((shades) => [shades.base, shades.deep]),
        );
        BANNED_BRAND_HEXES.forEach((banned) => {
            expect(familyHexes).not.toContain(banned);
            expect(Object.values(MemoryLayerColors)).not.toContain(banned);
            expect(Object.values(ToolStatusColors)).not.toContain(banned);
        });
    });

    it("meets body contrast (>=4.5:1) on the surface it sits on", () => {
        (["dark", "light"] as const).forEach((scheme) => {
            const palette = BLACKROSE_PALETTE[scheme];
            expect(contrast(palette.text, palette.bg)).toBeGreaterThanOrEqual(4.5);
            expect(contrast(palette.text, palette.surface)).toBeGreaterThanOrEqual(4.5);
            expect(contrast(palette.text, palette.surface2)).toBeGreaterThanOrEqual(4.5);
        });
    });

    it("meets secondary-ink contrast (>=4.5:1) and accent contrast (>=3:1)", () => {
        (["dark", "light"] as const).forEach((scheme) => {
            const palette = BLACKROSE_PALETTE[scheme];
            expect(contrast(palette.text2, palette.bg)).toBeGreaterThanOrEqual(4.5);
            expect(contrast(palette.text2, palette.surface)).toBeGreaterThanOrEqual(4.5);
            // Accent is used for rules, marks and large text.
            expect(contrast(palette.accent, palette.bg)).toBeGreaterThanOrEqual(3);
            expect(contrast(palette.accent, palette.surface)).toBeGreaterThanOrEqual(3);
            expect(contrast(palette.accentStrong, palette.bg)).toBeGreaterThanOrEqual(4.5);
        });
    });

    it("keeps semantic ok/danger readable on the void", () => {
        (["dark", "light"] as const).forEach((scheme) => {
            const palette = BLACKROSE_PALETTE[scheme];
            expect(contrast(palette.ok, palette.bg)).toBeGreaterThanOrEqual(4.5);
            expect(contrast(palette.danger, palette.bg)).toBeGreaterThanOrEqual(4.5);
        });
    });
});

describe("blackrose color themes", () => {
    it("makes Blackrose the default preset", () => {
        expect(DEFAULT_COLOR_THEME.presetId).toBe("blackrose");
        expect(DEFAULT_COLOR_THEME.colors).toEqual(BLACKROSE_COLOR_THEME_COLORS);
        expect(COLOR_THEME_PRESETS[0].presetId).toBe("blackrose");
        expect(COLOR_THEME_PRESETS[0].name).toBe("Blackrose");
    });

    it("seeds the app background from the palette in both schemes", () => {
        expect(AppBackgroundColors.light).toBe(BLACKROSE_PALETTE.light.bg);
        expect(AppBackgroundColors.dark).toBe(BLACKROSE_PALETTE.dark.bg);
    });

    it("uses bone as the Blackrose accent and never the assistant blue", () => {
        expect(BLACKROSE_COLOR_THEME_COLORS.accentLight).toBe(BLACKROSE_PALETTE.light.accent);
        expect(BLACKROSE_COLOR_THEME_COLORS.accentDark).toBe(BLACKROSE_PALETTE.dark.accent);
        expect(BLACKROSE_COLOR_THEME_COLORS.chatAiTextLight).toBe(BLACKROSE_PALETTE.light.accent);
        expect(BLACKROSE_COLOR_THEME_COLORS.chatAiTextDark).toBe(BLACKROSE_PALETTE.dark.accent);
        BANNED_BRAND_HEXES.forEach((banned) => {
            expect(Object.values(BLACKROSE_COLOR_THEME_COLORS)).not.toContain(banned);
        });
    });

    it("keeps the legacy palette non-default and out of the shipped default", () => {
        const legacy = COLOR_THEME_PRESETS.find((preset) => preset.presetId === "rosebud");
        expect(legacy).toBeDefined();
        expect(legacy?.name).not.toBe("Rosebud");
        expect(legacy?.colors).toEqual(LEGACY_ROSEBUD_COLOR_THEME_COLORS);
        expect(legacy?.presetId).not.toBe(DEFAULT_COLOR_THEME.presetId);
        // Legacy amber is opt-in only: it must not reach the default theme.
        BANNED_BRAND_HEXES.forEach((banned) => {
            expect(Object.values(DEFAULT_COLOR_THEME.colors)).not.toContain(banned);
        });
    });

    it("keeps every preset hex valid and accent slots in sync with chat text", () => {
        COLOR_THEME_PRESETS.forEach((preset) => {
            Object.values(preset.colors).forEach((hex) => {
                expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
            });
            expect(preset.colors.chatAiTextLight).toBe(preset.colors.accentLight);
            expect(preset.colors.chatAiTextDark).toBe(preset.colors.accentDark);
        });
    });

    it("shares the Blackrose neutrals across every preset", () => {
        COLOR_THEME_PRESETS.forEach((preset) => {
            expect(preset.colors.appBackgroundLight).toBe(BLACKROSE_PALETTE.light.bg);
            expect(preset.colors.appBackgroundDark).toBe(BLACKROSE_PALETTE.dark.bg);
            expect(preset.colors.appTextLight).toBe(BLACKROSE_PALETTE.light.text);
            expect(preset.colors.appTextDark).toBe(BLACKROSE_PALETTE.dark.text);
            expect(preset.colors.chatUserTextLight).toBe(BLACKROSE_PALETTE.light.text);
            expect(preset.colors.chatUserTextDark).toBe(BLACKROSE_PALETTE.dark.text);
        });
    });
});
