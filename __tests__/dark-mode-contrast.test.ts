import fs from "fs";
import path from "path";
import { glob } from "glob";

import { BLACKROSE_PALETTE } from "../constants/blackrose";

/**
 * Static analysis tests to prevent dark mode contrast regressions.
 * Catches hardcoded icon colors and bare Text elements that would be
 * invisible on dark backgrounds, plus stray pre-rewrite brand hexes.
 */
describe("dark mode contrast safety", () => {
    const uiDirs = [
        path.join(process.cwd(), "app"),
        path.join(process.cwd(), "components"),
    ];

    function getUIFiles(): string[] {
        const files: string[] = [];
        for (const dir of uiDirs) {
            const found = glob.sync("**/*.{tsx,jsx}", { cwd: dir });
            files.push(...found.map((f) => path.join(dir, f)));
        }
        return files;
    }

    it('no hardcoded color="#111827" on icons (invisible in dark mode)', () => {
        const violations: string[] = [];
        for (const file of getUIFiles()) {
            const content = fs.readFileSync(file, "utf-8");
            const lines = content.split("\n");
            lines.forEach((line, i) => {
                if (
                    line.includes('color="#111827"') &&
                    (line.includes("Icons") || line.includes("Icon"))
                ) {
                    violations.push(
                        `${path.relative(process.cwd(), file)}:${i + 1}`
                    );
                }
            });
        }
        expect(violations).toEqual([]);
    });

    it("does not pass className to MaterialIcons (use color prop + useColorScheme)", () => {
        const violations: string[] = [];
        for (const file of getUIFiles()) {
            const content = fs.readFileSync(file, "utf-8");
            const lines = content.split("\n");
            lines.forEach((line, i) => {
                if (line.includes("<MaterialIcons") && line.includes("className=")) {
                    violations.push(`${path.relative(process.cwd(), file)}:${i + 1}`);
                }
            });
        }
        expect(violations).toEqual([]);
    });

    it("text-main-light/dark tokens exist for 30+ file usage", () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const config = require(path.join(
            process.cwd(),
            "tailwind.config.js"
        ));
        const colors = config?.theme?.extend?.colors ?? {};
        expect(colors).toHaveProperty("text-main-light");
        expect(colors).toHaveProperty("text-main-dark");
        expect(colors).toHaveProperty("user-text");
        expect(colors).toHaveProperty("user-text-dark");
        expect(colors).toHaveProperty("accent-blue");
        expect(colors).toHaveProperty("ai-text");
        expect(colors).toHaveProperty("subtext-light");
        expect(colors).toHaveProperty("subtext-dark");
        expect(colors).toHaveProperty("card-dark");
    });

    it("history mood label defines explicit dark-mode text color", () => {
        const file = path.join(
            process.cwd(),
            "components",
            "history",
            "HistoryEntryCard.tsx"
        );
        const content = fs.readFileSync(file, "utf-8");
        // Mood chip only renders when a real mood exists; text always has dark: pair.
        expect(content).toContain("{moodLabel}");
        expect(content).toContain(
            "const SECONDARY_TEXT_CLASS = 'text-text-secondary-light dark:text-text-secondary-dark';"
        );
        expect(content).toMatch(
            /className=\{`text-\[14px\] \$\{SECONDARY_TEXT_CLASS\}`\}>/
        );
    });

    it("memory hub graph link is not dark-only chrome", () => {
        const file = path.join(
            process.cwd(),
            "components",
            "memory",
            "MemoryHubScreen.tsx"
        );
        const content = fs.readFileSync(file, "utf-8");
        expect(content).toContain("Open graph");
        expect(content).toContain("border-hairline-light");
        expect(content).toContain("text-text-light underline dark:text-text-dark");
        expect(content).not.toContain("bg-gray-950");
    });

    it("memory graph stage background adapts to color scheme", () => {
        const file = path.join(
            process.cwd(),
            "components",
            "memory-graph",
            "MemoryGraphScreen.tsx"
        );
        const content = fs.readFileSync(file, "utf-8");
        expect(content).toContain("stageBackground");
        expect(content).toContain("colorScheme=");
        expect(content).not.toMatch(
            /style=\{\{\s*backgroundColor:\s*'#070B14'\s*\}\}/
        );
    });

    it("no UI file hardcodes a pre-rewrite brand hex or the old dark surfaces", () => {
        const bannedHexes = [
            "#FF9F0A",
            "#FFB340",
            "#E91E63",
            "#38BDF8",
            "#3B82F6",
            "#0A0A0A",
        ];
        const violations: string[] = [];
        for (const file of getUIFiles()) {
            const content = fs.readFileSync(file, "utf-8");
            content.split("\n").forEach((line, i) => {
                bannedHexes.forEach((hex) => {
                    if (line.toUpperCase().includes(hex)) {
                        violations.push(
                            `${path.relative(process.cwd(), file)}:${i + 1} ${hex}`
                        );
                    }
                });
            });
        }
        expect(violations).toEqual([]);
    });

    it("the memory graph ships the Blackrose void, not the old night-sky paint", () => {
        const enginePath = path.join(
            process.cwd(),
            "assets",
            "memory-graph",
            "engine.html"
        );
        const engine = fs.readFileSync(enginePath, "utf-8");

        // The engine receives both schemes via SET_THEME; the palette it paints
        // must be the Blackrose families, not an unrelated night-sky set.
        expect(engine).toContain("SET_THEME");
        expect(engine.toUpperCase()).toContain(BLACKROSE_PALETTE.dark.surface.toUpperCase());
        expect(engine.toUpperCase()).toContain(BLACKROSE_PALETTE.dark.accent.toUpperCase());
        expect(engine.toUpperCase()).toContain(BLACKROSE_PALETTE.light.bg.toUpperCase());
    });
});
