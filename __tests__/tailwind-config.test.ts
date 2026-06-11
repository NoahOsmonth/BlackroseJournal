import path from "path";

describe("tailwind.config.js", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require(path.join(process.cwd(), "tailwind.config.js"));
    const colors = config?.theme?.extend?.colors ?? {};

    const requiredColorTokens = [
        "background-light",
        "background-dark",
        "surface-light",
        "surface-dark",
        "card-dark",
        "primary",
        "primary-dark",
        "text-light",
        "text-dark",
        "text-main-light",
        "text-main-dark",
        "user-text",
        "user-text-dark",
        "accent-blue",
        "accent-green",
        "accent-green-dark",
        "accent-yellow",
        "ai-text",
        "text-primary-light",
        "text-primary-dark",
        "text-secondary-light",
        "text-secondary-dark",
        "subtext-light",
        "subtext-dark",
        "divider-light",
        "divider-dark",
        "secondary-dark",
    ];

    it("defines all required color tokens", () => {
        requiredColorTokens.forEach((token) => {
            expect(colors).toHaveProperty(token);
        });
    });

    it("all color values are valid hex strings", () => {
        Object.entries(colors).forEach(([key, value]) => {
            expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
        });
    });

    it("light/dark background matches theme.ts", () => {
        expect(colors["background-light"]).toBe("#F2F2F7");
        expect(colors["background-dark"]).toBe("#000000");
    });

    it("light/dark surface matches theme.ts", () => {
        expect(colors["surface-light"]).toBe("#FFFFFF");
        expect(colors["surface-dark"]).toBe("#1C1C1E");
    });

    it("ai text matches the intention chat reference cyan", () => {
        expect(colors["ai-text"]).toBe("#38BDF8");
    });

    it("user text uses a warm darker tone distinct from AI text", () => {
        expect(colors["user-text"]).toBe("#7C2D12");
        expect(colors["user-text-dark"]).toBe("#FDBA74");
        expect(colors["user-text"]).not.toBe(colors["ai-text"]);
    });
});
