import fs from "fs";
import path from "path";

import { BANNED_BRAND_HEXES, BLACKROSE_PALETTE } from "../constants/blackrose";
import { AppBackgroundColors } from "../constants/theme";

describe("tailwind.config.js", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require(path.join(process.cwd(), "tailwind.config.js"));
    const colors = config?.theme?.extend?.colors ?? {};

    const requiredColorTokens = [
        // Surfaces
        "background-light",
        "background-dark",
        "surface-light",
        "surface-dark",
        "surface-2-light",
        "surface-2-dark",
        "hairline-light",
        "hairline-dark",
        "card-dark",
        // Ink
        "text-light",
        "text-dark",
        "text-main-light",
        "text-main-dark",
        "text-primary-light",
        "text-primary-dark",
        "text-secondary-light",
        "text-secondary-dark",
        "subtext-light",
        "subtext-dark",
        "ink-2-light",
        "ink-2-dark",
        // Accent
        "primary",
        "primary-dark",
        "bone-light",
        "bone-dark",
        // Semantic
        "ok-light",
        "ok-dark",
        "danger-light",
        "danger-dark",
        "rose-muted-light",
        "rose-muted-dark",
        // Chat
        "user-text",
        "user-text-dark",
        "accent-blue",
        "ai-text",
        // Dividers / legacy aliases
        "divider-light",
        "divider-dark",
        "secondary-dark",
        "accent-green",
        "accent-green-dark",
        "accent-yellow",
    ];

    it("defines all required color tokens", () => {
        requiredColorTokens.forEach((token) => {
            expect(colors).toHaveProperty(token);
        });
    });

    const variableBackedTokens = [
        "primary",
        "primary-dark",
        "background-light",
        "background-dark",
        "text-light",
        "text-dark",
        "text-main-light",
        "text-main-dark",
        "user-text",
        "user-text-dark",
        "accent-blue",
        "ai-text",
        "text-primary-light",
        "text-primary-dark",
        "text-secondary-light",
        "text-secondary-dark",
        "subtext-light",
        "subtext-dark",
    ];

    it("all color values are valid hex strings or runtime color variables", () => {
        Object.entries(colors).forEach(([key, value]) => {
            const isVariableBacked = variableBackedTokens.includes(key);
            if (isVariableBacked) {
                expect(value).toMatch(/^rgb\(var\(--color-[a-z-]+\) \/ <alpha-value>\)$/);
            } else {
                expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
            }
        });
    });

    it("light/dark background uses runtime variables mapped to theme.ts hex values", () => {
        expect(colors["background-light"]).toBe("rgb(var(--color-background-light) / <alpha-value>)");
        expect(colors["background-dark"]).toBe("rgb(var(--color-background-dark) / <alpha-value>)");

        const css = fs.readFileSync(path.join(process.cwd(), "global.css"), "utf8");
        expect(css).toContain("--color-background-light: 244 241 235;");
        expect(css).toContain("--color-background-dark: 12 12 14;");

        expect(AppBackgroundColors.light).toBe("#F4F1EB");
        expect(AppBackgroundColors.dark).toBe("#0C0C0E");
    });

    it("light/dark surface matches the Blackrose palette", () => {
        expect(colors["surface-light"]).toBe(BLACKROSE_PALETTE.light.surface);
        expect(colors["surface-dark"]).toBe(BLACKROSE_PALETTE.dark.surface);
        expect(colors["surface-2-light"]).toBe(BLACKROSE_PALETTE.light.surface2);
        expect(colors["surface-2-dark"]).toBe(BLACKROSE_PALETTE.dark.surface2);
        expect(colors["hairline-light"]).toBe(BLACKROSE_PALETTE.light.hairline);
        expect(colors["hairline-dark"]).toBe(BLACKROSE_PALETTE.dark.hairline);
    });

    it("carries bone/sage/danger/muted-rose semantic tokens", () => {
        expect(colors["bone-light"]).toBe(BLACKROSE_PALETTE.light.accent);
        expect(colors["bone-dark"]).toBe(BLACKROSE_PALETTE.dark.accent);
        expect(colors["ok-light"]).toBe(BLACKROSE_PALETTE.light.ok);
        expect(colors["ok-dark"]).toBe(BLACKROSE_PALETTE.dark.ok);
        expect(colors["danger-light"]).toBe(BLACKROSE_PALETTE.light.danger);
        expect(colors["danger-dark"]).toBe(BLACKROSE_PALETTE.dark.danger);
        expect(colors["rose-muted-light"]).toBe(BLACKROSE_PALETTE.light.roseMuted);
        expect(colors["rose-muted-dark"]).toBe(BLACKROSE_PALETTE.dark.roseMuted);
    });

    it("keeps the memory graph to three families (bone/sage/muted rose)", () => {
        const graphFamilies = ["bone", "sage", "rose"];
        graphFamilies.forEach((family) => {
            const keys = Object.keys(colors).filter((key) => key.startsWith(`graph-${family}`));
            expect(keys.length).toBeGreaterThanOrEqual(2);
            keys.forEach((key) => {
                expect(colors[key]).toMatch(/^#[0-9A-Fa-f]{6}$/);
            });
        });

        const graphKeys = Object.keys(colors).filter((key) => key.startsWith("graph-"));
        graphKeys.forEach((key) => {
            expect(graphFamilies.some((family) => key.startsWith(`graph-${family}`))).toBe(true);
        });
    });

    it("never ships a banned brand hex as a token value or runtime default", () => {
        Object.entries(colors).forEach(([key, value]) => {
            if (typeof value === "string" && value.startsWith("#")) {
                expect(BANNED_BRAND_HEXES).not.toContain(value.toUpperCase());
            }
            // Guard against a banned hex smuggled in through a runtime variable seed.
            expect(`${key}:${String(value)}`).not.toMatch(/#(FF9F0A|FFB340|E91E63|38BDF8|3B82F6|60A5FA)/i);
        });

        const css = fs.readFileSync(path.join(process.cwd(), "global.css"), "utf8");
        BANNED_BRAND_HEXES.forEach((banned) => {
            expect(css.toUpperCase()).not.toContain(banned);
        });
    });

    it("defines radii and font families for the Blackrose layout language", () => {
        const borderRadius = config?.theme?.extend?.borderRadius ?? {};
        expect(borderRadius.control).toBe("12px");
        expect(borderRadius.card).toBe("16px");
        expect(borderRadius.sheet).toBe("28px");

        const fontFamily = config?.theme?.extend?.fontFamily ?? {};
        expect(fontFamily.serif.join(" ")).toContain("Playfair Display");
        expect(fontFamily.sans.join(" ")).toContain("Plus Jakarta Sans");
    });

    it("light/dark surface pair exists for every surface token (AGENTS rule 1)", () => {
        const surfaceTokens = ["surface", "surface-2", "hairline", "bone", "ok", "danger", "rose-muted", "ink-2"];
        surfaceTokens.forEach((token) => {
            expect(colors).toHaveProperty(`${token}-light`);
            expect(colors).toHaveProperty(`${token}-dark`);
        });
    });

    it("ai text matches the bone companion accent", () => {
        expect(colors["ai-text"]).toBe("rgb(var(--color-ai-text) / <alpha-value>)");
        expect(colors["accent-blue"]).toBe("rgb(var(--color-accent-blue) / <alpha-value>)");

        const css = fs.readFileSync(path.join(process.cwd(), "global.css"), "utf8");
        expect(css).toContain("--color-ai-text: 201 194 182;");
        expect(css).toContain("--color-accent-blue: 92 86 76;");
    });

    it("user text uses ink, distinct from the bone companion text", () => {
        expect(colors["user-text"]).toBe("rgb(var(--color-user-text) / <alpha-value>)");
        expect(colors["user-text-dark"]).toBe("rgb(var(--color-user-text-dark) / <alpha-value>)");
        expect(colors["user-text"]).not.toBe(colors["ai-text"]);
    });
});
