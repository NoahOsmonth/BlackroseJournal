import fs from "fs";
import path from "path";

describe("warning cleanup", () => {
    it("removes deprecated header wrappers", () => {
        const todayHeaderPath = path.join(
            process.cwd(),
            "components",
            "today",
            "TodayHeader.tsx"
        );
        const journalHeaderPath = path.join(
            process.cwd(),
            "components",
            "journal",
            "JournalHeader.tsx"
        );

        if (fs.existsSync(todayHeaderPath)) {
            const todaySource = fs.readFileSync(todayHeaderPath, "utf-8");
            expect(todaySource).not.toMatch(/export\s+function\s+TodayHeader/);
        }

        if (fs.existsSync(journalHeaderPath)) {
            const journalSource = fs.readFileSync(journalHeaderPath, "utf-8");
            expect(journalSource).not.toMatch(/export\s+function\s+JournalHeader/);
        }
    });

    it("keeps AppHeader variants limited", () => {
        const appHeaderPath = path.join(
            process.cwd(),
            "components",
            "navigation",
            "AppHeader.tsx"
        );
        const source = fs.readFileSync(appHeaderPath, "utf-8");

        expect(source).toMatch(/type\s+HeaderVariant\s*=\s*'today'\s*\|\s*'history'/);
        expect(source).not.toMatch(/'journal'|"journal"/);
    });
});
