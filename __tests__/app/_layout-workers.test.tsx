/**
 * Smoke test: `app/_layout.tsx` must import `registerAllWorkers`
 * from `@/services/workers` and call it. This is a static-analysis
 * check; the deeper behavior of `registerAllWorkers` is covered by
 * `__tests__/services/workers/taskRegistry.test.ts`.
 */
import fs from "fs";
import path from "path";

describe("app/_layout.tsx — workers wiring", () => {
    const layoutPath = path.join(process.cwd(), "app", "_layout.tsx");
    const source = fs.readFileSync(layoutPath, "utf-8");

    it("imports registerAllWorkers from @/services/workers", () => {
        expect(source).toMatch(
            /import\s*\{\s*registerAllWorkers\s*\}\s*from\s*['"]@\/services\/workers['"]/
        );
    });

    it("calls registerAllWorkers() at module/effect scope", () => {
        expect(source).toMatch(/registerAllWorkers\(\)/);
    });
});
