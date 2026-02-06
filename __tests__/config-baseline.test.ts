import fs from "fs";
import path from "path";

describe("package.json baseline", () => {
    const packageJsonPath = path.join(process.cwd(), "package.json");

    it("exists", () => {
        expect(fs.existsSync(packageJsonPath)).toBe(true);
    });

    it("includes required scripts", () => {
        if (!fs.existsSync(packageJsonPath)) {
            throw new Error("package.json is missing");
        }

        const raw = fs.readFileSync(packageJsonPath, "utf-8");
        const parsed = JSON.parse(raw) as { scripts?: Record<string, string> };
        const scripts = parsed.scripts ?? {};

        const requiredScripts = [
            "start",
            "android",
            "ios",
            "lint",
            "typecheck",
            "test",
            "test:run",
            "test:run:verbose",
            "check:design",
        ];

        const resetScriptPath = path.join(
            process.cwd(),
            "scripts",
            "reset-project.js"
        );
        if (fs.existsSync(resetScriptPath)) {
            requiredScripts.push("reset-project");
        }

        requiredScripts.forEach((script) => {
            expect(scripts).toHaveProperty(script);
        });
    });
});
