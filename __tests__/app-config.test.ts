import fs from "fs";
import path from "path";

describe("app.json config", () => {
    const appJsonPath = path.join(process.cwd(), "app.json");

    it("exists", () => {
        expect(fs.existsSync(appJsonPath)).toBe(true);
    });

    it("matches required Expo settings", () => {
        if (!fs.existsSync(appJsonPath)) {
            throw new Error("app.json is missing");
        }

        const raw = fs.readFileSync(appJsonPath, "utf-8");
        const parsed = JSON.parse(raw) as {
            expo?: {
                name?: string;
                slug?: string;
                userInterfaceStyle?: string;
                platforms?: string[];
                plugins?: string[];
                ios?: {
                    bundleIdentifier?: string;
                };
                android?: {
                    package?: string;
                };
            };
        };

        const expo = parsed.expo ?? {};
        const platforms = expo.platforms ?? [];
        const plugins = expo.plugins ?? [];

        expect(expo.name).toBe("blackrosejournal");
        expect(expo.slug).toBe("blackrosejournal");
        expect(expo.userInterfaceStyle).toBe("automatic");
        expect(platforms).toEqual(["ios", "android", "web"]);
        expect(plugins).toContain("expo-router");
        expect(expo.ios?.bundleIdentifier).toBe("com.blackrosejournal");
        expect(expo.android?.package).toBe("com.blackrosejournal");
    });
});
