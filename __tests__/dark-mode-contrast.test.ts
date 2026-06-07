import fs from "fs";
import path from "path";
import { glob } from "glob";

/**
 * Static analysis tests to prevent dark mode contrast regressions.
 * Catches hardcoded icon colors and bare Text elements that would be
 * invisible on dark backgrounds.
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
        expect(content).toContain("{mood.label}");
        expect(content).toContain(
            '<Text className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">{mood.label}</Text>'
        );
    });
});
