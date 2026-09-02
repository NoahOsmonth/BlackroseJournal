import fs from "fs";
import path from "path";

/**
 * Guard: phosphor-react-native was removed from the bundle (its 3,000-module
 * icon barrel cost ~5.6 MB of the release bundle). The Metro remap for it must
 * not come back, and new-arch requirements must stay in place.
 */
describe("metro config", () => {
  const metroPath = path.join(process.cwd(), "metro.config.js");
  const appJsonPath = path.join(process.cwd(), "app.json");

  it("no longer remaps phosphor-react-native to a lib entry", () => {
    const source = fs.readFileSync(metroPath, "utf-8");
    expect(source).not.toContain("phosphor-react-native");
    expect(source).not.toContain("resolveRequest");
  });

  it("keeps the phosphor dependency out of package.json", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8")) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.["phosphor-react-native"]).toBeUndefined();
  });

  it("banishes barrel imports from @expo/vector-icons", (done) => {
    // Barrel imports (@expo/vector-icons) pull every icon family into the
    // bundle; per-family subpaths (…/MaterialIcons) tree-shake to one font.
    const { execFile } = require("child_process");
    execFile(
      "grep",
      ["-rn", "from '@expo/vector-icons'", "app", "components", "constants", "hooks", "features"],
      { maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => {
        const hits = stdout.split("\n").filter((l: string) => l.trim().length > 0);
        expect({ err, hits }).toMatchObject({ err: { code: 1 }, hits: [] });
        done();
      },
    );
  });

  it("enables new architecture required by reanimated/worklets", () => {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8")) as {
      expo?: { newArchEnabled?: boolean };
    };
    expect(appJson.expo?.newArchEnabled).toBe(true);
  });
});
