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

  it("banishes barrel imports from @expo/vector-icons", () => {
    // Barrel imports (@expo/vector-icons) pull every icon family into the
    // bundle; per-family subpaths (…/MaterialIcons) tree-shake to one font.
    // Scanned in-process instead of shelling out to grep: grep is not
    // guaranteed on Windows, and execFile ENOENT'ed there.
    const dirs = ["app", "components", "constants", "hooks", "features"];
    const needle = "from '@expo/vector-icons'";
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (fs.readFileSync(full, "utf8").includes(needle)) hits.push(full);
      }
    };
    dirs.forEach((d) => walk(path.join(process.cwd(), d)));
    expect(hits).toEqual([]);
  });

  it("enables new architecture required by reanimated/worklets", () => {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8")) as {
      expo?: { newArchEnabled?: boolean };
    };
    expect(appJson.expo?.newArchEnabled).toBe(true);
  });
});
