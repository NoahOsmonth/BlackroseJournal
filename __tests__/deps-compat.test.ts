import fs from "fs";
import path from "path";

describe("dependency compatibility", () => {
    it("uses legacy-compatible dependencies", () => {
        const packageJsonPath = path.join(__dirname, "..", "package.json");
        const rawPackageJson = fs.readFileSync(packageJsonPath, "utf-8");
        const packageJson = JSON.parse(rawPackageJson) as {
            dependencies?: Record<string, string>;
        };
        const dependencies = packageJson.dependencies ?? {};

        const reanimatedVersion = dependencies["react-native-reanimated"];
        expect(reanimatedVersion).toBeDefined();
        const isExpectedReanimated =
            reanimatedVersion.startsWith("4.") || /^~4\./.test(reanimatedVersion);
        expect(isExpectedReanimated).toBe(true);

        const workletsVersion = dependencies["react-native-worklets"];
        expect(workletsVersion).toBeDefined();
        expect(workletsVersion).toBe("0.5.1");

        expect(dependencies).not.toHaveProperty("expo-dev-client");
    });
});
