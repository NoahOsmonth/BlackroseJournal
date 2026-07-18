import fs from "fs";
import path from "path";

/**
 * Guard: phosphor-react-native@3.x publishes `react-native: src/index.tsx`
 * without shipping `src/`. Release APK bundling fails unless Metro remaps it
 * to `lib/module/index.js`.
 */
describe("metro phosphor-react-native resolve", () => {
  const metroPath = path.join(process.cwd(), "metro.config.js");
  const appJsonPath = path.join(process.cwd(), "app.json");

  it("remaps phosphor-react-native to the published lib entry", () => {
    const source = fs.readFileSync(metroPath, "utf-8");
    expect(source).toContain("phosphor-react-native");
    expect(source).toContain("lib/module/index.js");
    expect(source).toContain("resolveRequest");
  });

  it("enables new architecture required by reanimated/worklets", () => {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8")) as {
      expo?: { newArchEnabled?: boolean };
    };
    expect(appJson.expo?.newArchEnabled).toBe(true);
  });
});
