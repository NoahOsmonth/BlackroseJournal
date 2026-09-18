/**
 * THEME sweep executor (one script, both schemes, one tab walk).
 * Concept images live read-only under example-design/concepts/generated/.
 * Output: per-screen light+dark bg color probes + screenshots under output/qa/.
 *
 * NOT run with node directly: this file is sourced into a playwriter -e eval
 * context where the global `state.page` (the connected browser page) exists:
 *   playwriter -s 1 --timeout 600000 -e "$(cat scripts/qa/theme-sweep.mjs)"
 */
/* eslint-env browser */
/* global state */
const BASE = process.argv[2] || "http://localhost:8081";

const SCREENS = [
    { id: "THEME-02", path: "/entries", name: "entries" },
    { id: "THEME-04", path: "/goals", name: "goals" },
    { id: "THEME-06", path: "/settings", name: "settings" },
    { id: "THEME-01", path: "/", name: "today" },
];

/** Switch theme via Settings accordion (the user-facing path). */
async function setTheme(page, mode) {
    await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    await page.getByRole("button", { name: /^Appearance/ }).click();
    await page.waitForTimeout(1200);
    await page.getByRole("radio", { name: `Select ${mode} theme` }).click();
    await page.waitForTimeout(1500);
}

async function probe(page, name, scheme) {
    const bg = await page.evaluate(() => {
        let n = document.elementFromPoint(window.innerWidth / 2, 80);
        while (n) {
            const b = getComputedStyle(n).backgroundColor;
            if (b && b !== "rgba(0, 0, 0, 0)") return b;
            n = n.parentElement;
        }
        return "none";
    });
    const shot = `output/qa/theme-${name}-${scheme}.png`;
    await page.screenshot({ path: shot });
    console.log(`${name} [${scheme}] bg=${bg} shot=${shot}`);
    return { name, scheme, bg, shot };
}

const results = [];
for (const screen of SCREENS) {
    for (const scheme of ["Light", "Dark"]) {
        await setTheme(state.page, scheme);
        await state.page.goto(`${BASE}${screen.path}`, { waitUntil: "domcontentloaded" });
        await state.page.waitForTimeout(4000);
        results.push(await probe(state.page, screen.name, scheme.toLowerCase()));
    }
}
console.log("\nSUMMARY");
for (const r of results) console.log(`${r.name} ${r.scheme}: ${r.bg}`);
