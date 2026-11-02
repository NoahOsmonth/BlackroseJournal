/**
 * Cold-mount benchmark — the other half of the UI/UX budgets.
 *
 * `tab-switch-bench.mjs` measures a re-focus of a screen that stays mounted.
 * This measures the first mount: a fresh page load straight onto a route, which
 * is what a deep link, a reload or a first launch after the splash costs. It is
 * a different path (module init + first read + first render), so it needs its
 * own numbers rather than being inferred from the switch bench.
 *
 * Reports, per route, over N cold loads:
 *
 *   - `contentAtMs`    load -> the route's content element is present and visible
 *   - `longTaskMaxMs`  longest main-thread task (the budget metric)
 *   - `frameGapMaxMs`  worst single animation-frame gap
 *   - `storageGet`     localStorage reads during the mount
 *
 * There is no skeleton column on purpose: a cold mount is judged on
 * time-to-content, since it has no prior paint to preserve.
 *
 *   node scripts/qa/route-mount-bench.mjs
 *
 * Env: EXPO_WEB_URL, BENCH_OUT, BENCH_ROUNDS, BENCH_LABEL, BENCH_ROUTES
 * (`today,explore,insights,entries`).
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { launchOptions } from './chromium.mjs';
import { instrument, startSampling, stopSampling } from './bench-instrument.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const BASE = (process.env.EXPO_WEB_URL || 'http://localhost:8081').replace(/\/$/, '');
const OUT = process.env.BENCH_OUT || path.join(ROOT, 'output', 'perf');
const LABEL = String(process.env.BENCH_LABEL || 'run').replace(/[^A-Za-z0-9._-]+/g, '-');
const ROUNDS = Number(process.env.BENCH_ROUNDS || 3);

/** Dock labels and a selector that only matches once the screen has content. */
const ROUTES = {
  today: { label: 'Today', path: '/today' },
  explore: { label: 'Threads', path: '/explore' },
  insights: { label: 'Insights', path: '/insights' },
  entries: { label: 'Archive', path: '/entries' },
};

const ROUTE_KEYS = process.env.BENCH_ROUTES
  ? process.env.BENCH_ROUTES.split(',').map((name) => name.trim())
  : Object.keys(ROUTES);

for (const key of ROUTE_KEYS) {
  if (!ROUTES[key]) {
    throw new Error(`BENCH_ROUTES entry "${key}" must be one of: ${Object.keys(ROUTES).join(', ')}`);
  }
}

/**
 * Cold mount has no "route changed" event to anchor on, so the sampler watches
 * for the dock tab that belongs to the route being selected. That element only
 * exists once the tab tree has rendered, which is exactly the moment a person
 * would call the screen "there".
 */
function contentSelectorFor(key) {
  return `[role="tab"][aria-label="${ROUTES[key].label}"]`;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch(launchOptions({ headless: true, timeout: 60000 }));
  const rows = [];
  const pageErrors = [];

  for (const key of ROUTE_KEYS) {
    const route = ROUTES[key];
    for (let round = 0; round < ROUNDS; round += 1) {
      // A brand-new context per load: no warm module cache, no carried state.
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
      });
      const page = await context.newPage();
      page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 200)));
      await page.addInitScript(instrument);

      await page.goto(BASE + route.path, { waitUntil: 'commit', timeout: 120000 });
      await page.evaluate(startSampling, { contentSelector: contentSelectorFor(key) });
      await page.waitForFunction(
        (selector) => {
          const el = document.querySelector(selector);
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        contentSelectorFor(key),
        { timeout: 120000 },
      );
      // Let the mount settle so late tasks inside the same window are counted.
      await page.waitForTimeout(1200);
      const sample = await page.evaluate(stopSampling);

      rows.push({
        route: key,
        round,
        contentAtMs: sample.contentAtMs,
        frameGapMaxMs: sample.frameGapMaxMs,
        frameGapP95Ms: sample.frameGapP95Ms,
        longTaskMaxMs: sample.longTaskMaxMs,
        longTaskTotalMs: sample.longTaskTotalMs,
        storageGet: sample.storageGet,
        storageGetMs: sample.storageGetMs,
        topKeys: sample.topKeys,
      });

      if (round === 0) {
        await page.screenshot({
          path: path.join(OUT, `${LABEL}-mount-${key}.png`),
          timeout: 20000,
        });
      }
      await context.close();
    }
  }

  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  };
  const byRoute = {};
  for (const row of rows) {
    const bucket = byRoute[row.route] || (byRoute[row.route] = []);
    bucket.push(row);
  }
  const table = Object.entries(byRoute).map(([route, samples]) => ({
    route,
    samples: samples.length,
    contentAtMs: median(samples.map((s) => s.contentAtMs ?? -1)),
    frameGapMaxMs: median(samples.map((s) => s.frameGapMaxMs)),
    longTaskMaxMs: median(samples.map((s) => s.longTaskMaxMs)),
    longTaskTotalMs: median(samples.map((s) => s.longTaskTotalMs)),
    storageGet: median(samples.map((s) => s.storageGet)),
    topKeys: samples[0].topKeys,
  }));

  const report = { label: LABEL, base: BASE, rounds: ROUNDS, table, rows, pageErrors };
  fs.writeFileSync(path.join(OUT, `route-mount-${LABEL}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ label: LABEL, table, pageErrors }, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error('mount bench failed:', error);
  process.exit(1);
});
