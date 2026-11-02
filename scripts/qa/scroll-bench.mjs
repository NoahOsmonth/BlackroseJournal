/**
 * Scroll-smoothness benchmark — the third path, and the last one that is
 * app-side.
 *
 * A tab switch and a cold mount both measure how long until a screen is usable.
 * This measures what it feels like once it is: a scroll through a list, where a
 * janky frame is the whole symptom. Scrolling has no "done" moment, so it is
 * judged purely on frame pacing.
 *
 * Reports, per route, over N scroll passes:
 *
 *   - `frameGapMaxMs`   worst single animation-frame gap during the scroll
 *   - `frameGapP95Ms`   the sustained tail (a single hitch is not a stutter)
 *   - `framesDropped`   frames slower than 2x the display interval
 *   - `longTaskMaxMs`   longest main-thread task (the budget metric)
 *   - `longTaskTotalMs` sum of those tasks, for context
 *
 *   node scripts/qa/scroll-bench.mjs
 *
 * Env: EXPO_WEB_URL, BENCH_OUT, BENCH_ROUNDS, BENCH_LABEL, BENCH_ROUTES.
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

/** Routes with a scrollable list. Today is short, so it is not sampled. */
const ROUTES = {
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
 * Wheel-scroll the list from top to bottom over roughly `ms`, in `steps`
 * increments. A real wheel event is used rather than `scrollTo` so the app's own
 * scroll handlers (`onScroll`, reveal animations) run exactly as they would
 * under a finger.
 *
 * Returns the offset observed before and after, so the caller can prove the page
 * actually moved instead of trusting a clean frame profile.
 */
async function wheelScroll(page, { ms = 1600, steps = 40 } = {}) {
  // React Native Web puts the list in a `div` with `overflow-y: auto`, not on
  // the document — `window.scrollY` stays 0 no matter how far it scrolls.
  const offset = () => page.evaluate(() => {
    for (const el of document.querySelectorAll('div')) {
      const style = getComputedStyle(el);
      if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 20) {
        return el.scrollTop;
      }
    }
    return window.scrollY;
  });

  const before = await offset();
  const perStep = Math.max(1, Math.round(120 / steps));
  const wait = Math.max(1, Math.round(ms / steps));
  for (let i = 0; i < steps; i += 1) {
    await page.mouse.wheel(0, perStep * 30);
    await page.waitForTimeout(wait);
  }
  const after = await offset();
  return { before, after, delta: after - before };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch(launchOptions({ headless: true, timeout: 60000 }));
  const rows = [];
  const pageErrors = [];

  for (const key of ROUTE_KEYS) {
    const route = ROUTES[key];
    for (let round = 0; round < ROUNDS; round += 1) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
      });
      const page = await context.newPage();
      page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 200)));
      await page.addInitScript(instrument);

      await page.goto(BASE + route.path, { waitUntil: 'commit', timeout: 120000 });
      await page.getByRole('tab', { name: route.label }).waitFor({ state: 'visible', timeout: 120000 });
      // Let the first paint settle; this bench is about scrolling, not mounting.
      await page.waitForTimeout(2500);

      await page.mouse.move(195, 500);
      await page.evaluate(startSampling);
      const scroll = await wheelScroll(page);
      const sample = await page.evaluate(stopSampling);

      // A pass that did not move the page measures an idle window, not a
      // scroll. Fail loudly rather than report a perfect frame profile.
      if (scroll.delta < 100) {
        throw new Error(
          `${key} round ${round}: wheel scroll moved ${scroll.delta}px `
          + `(${scroll.before} -> ${scroll.after}); the list did not scroll`,
        );
      }

      rows.push({
        route: key,
        round,
        scrolledPx: scroll.delta,
        frameGapMaxMs: sample.frameGapMaxMs,
        frameGapP95Ms: sample.frameGapP95Ms,
        // 16.7 ms is one frame at 60 Hz; 2x that is a visible drop.
        framesDropped: sample.gaps.filter((gap) => gap > 33.4).length,
        frameCount: sample.frames,
        longTaskMaxMs: sample.longTaskMaxMs,
        longTaskTotalMs: sample.longTaskTotalMs,
        storageGet: sample.storageGet,
      });

      if (round === 0) {
        await page.screenshot({
          path: path.join(OUT, `${LABEL}-scroll-${key}.png`),
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
    frameGapMaxMs: median(samples.map((s) => s.frameGapMaxMs)),
    frameGapP95Ms: median(samples.map((s) => s.frameGapP95Ms)),
    framesDropped: median(samples.map((s) => s.framesDropped)),
    longTaskMaxMs: median(samples.map((s) => s.longTaskMaxMs)),
    longTaskTotalMs: median(samples.map((s) => s.longTaskTotalMs)),
    storageGet: median(samples.map((s) => s.storageGet)),
  }));

  // `frameCount` is already compact; no per-frame detail is kept.
  const report = { label: LABEL, base: BASE, rounds: ROUNDS, table, rows, pageErrors };
  fs.writeFileSync(path.join(OUT, `scroll-${LABEL}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ label: LABEL, table, pageErrors }, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error('scroll bench failed:', error);
  process.exit(1);
});
