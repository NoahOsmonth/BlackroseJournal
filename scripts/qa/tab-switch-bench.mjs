/**
 * Dock tab-switch benchmark.
 *
 * Measures what a person feels when a dock tab is pressed, from inside the page:
 *
 *   - `skeletonMs`       how long a loading skeleton stays painted after the press
 *   - `routeAtMs`        press -> the destination route is selected
 *   - `longTaskMaxMs`    longest main-thread task >= 50 ms (the budget metric)
 *   - `longTaskTotalMs`  sum of those tasks, for context
 *   - `frameGapMaxMs`    worst single animation-frame gap in the window
 *   - `storageGet`       localStorage reads (AsyncStorage's web backend)
 *
 * Page-side instrumentation lives in `bench-instrument.mjs`, shared with the
 * cold-mount bench so the two cannot measure different things.
 *
 *   node scripts/qa/tab-switch-bench.mjs
 *
 * Env: EXPO_WEB_URL, BENCH_OUT, BENCH_ROUNDS, BENCH_LABEL, BENCH_PAIRS.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { launchOptions } from './chromium.mjs';
import { instrument, startSampling, stopSampling, summariseTimeline } from './bench-instrument.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const BASE = (process.env.EXPO_WEB_URL || 'http://localhost:8081').replace(/\/$/, '');
const OUT = process.env.BENCH_OUT || path.join(ROOT, 'output', 'perf');
// The label becomes a filename component, so it must not be able to escape OUT.
const LABEL = String(process.env.BENCH_LABEL || 'run').replace(/[^A-Za-z0-9._-]+/g, '-');
const ROUNDS = Number(process.env.BENCH_ROUNDS || 3);

/** Dock labels in render order. */
const TABS = {
  today: 'Today',
  explore: 'Threads',
  insights: 'Insights',
  entries: 'Archive',
};

/**
 * Arrivals at every dock destination, so a refresh-path regression on any of
 * them is measured — not just the two pairs issue #9 reported. Override with
 * `BENCH_PAIRS=explore>today,today>explore`.
 */
const DEFAULT_PAIRS = [
  ['explore', 'today'],
  ['insights', 'today'],
  ['entries', 'today'],
  ['today', 'explore'],
  ['today', 'insights'],
  ['today', 'entries'],
];
const PAIRS = process.env.BENCH_PAIRS
  ? process.env.BENCH_PAIRS.split(',').map((pair) => {
    const [from, to] = pair.split('>').map((name) => name.trim());
    if (!TABS[from] || !TABS[to]) {
      throw new Error(`BENCH_PAIRS entry "${pair}" must be <from>><to> using: ${Object.keys(TABS).join(', ')}`);
    }
    return [from, to];
  })
  : DEFAULT_PAIRS;

async function pressDockTab(page, label) {
  const tab = page.getByRole('tab', { name: label });
  await tab.waitFor({ state: 'visible', timeout: 30000 });
  await tab.click({ force: true, timeout: 20000 });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch(launchOptions({ headless: true, timeout: 60000 }));
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  await page.addInitScript(instrument);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 200)));

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByRole('tab', { name: 'Threads' }).waitFor({ state: 'visible', timeout: 120000 });
  await page.waitForTimeout(3000);

  const rows = [];
  for (const [from, to] of PAIRS) {
    for (let round = 0; round < ROUNDS; round += 1) {
      // Park on the source tab and let it settle, so every sample starts equal.
      await pressDockTab(page, TABS[from]);
      await page.waitForTimeout(1500);

      await page.evaluate(startSampling);
      await pressDockTab(page, TABS[to]);
      await page.waitForTimeout(1500);
      const sample = await page.evaluate(stopSampling);
      const timing = summariseTimeline(sample.timeline, to);

      rows.push({
        pair: `${from}->${to}`,
        round,
        routeAtMs: timing.routeAtMs,
        skeletonMs: timing.skeletonMs,
        skeletonShown: timing.skeletonShown,
        frameGapMaxMs: sample.frameGapMaxMs,
        frameGapP95Ms: sample.frameGapP95Ms,
        longTaskMaxMs: sample.longTaskMaxMs,
        longTaskTotalMs: sample.longTaskTotalMs,
        longTasks: sample.longTasks,
        storageGet: sample.storageGet,
        storageSet: sample.storageSet,
        storageGetMs: sample.storageGetMs,
        topKeys: sample.topKeys,
      });
      if (round === 0) {
        await page.screenshot({
          path: path.join(OUT, `${LABEL}-${from}-to-${to}.png`),
          timeout: 20000,
        });
      }
    }
  }

  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  };
  const byPair = {};
  for (const row of rows) {
    const bucket = byPair[row.pair] || (byPair[row.pair] = []);
    bucket.push(row);
  }
  const table = Object.entries(byPair).map(([pair, samples]) => ({
    pair,
    samples: samples.length,
    routeAtMs: median(samples.map((s) => s.routeAtMs ?? -1)),
    skeletonMs: median(samples.map((s) => s.skeletonMs)),
    skeletonShownRounds: samples.filter((s) => s.skeletonShown).length,
    frameGapMaxMs: median(samples.map((s) => s.frameGapMaxMs)),
    longTaskMaxMs: median(samples.map((s) => s.longTaskMaxMs)),
    longTaskTotalMs: median(samples.map((s) => s.longTaskTotalMs)),
    storageGet: median(samples.map((s) => s.storageGet)),
    storageGetMs: median(samples.map((s) => s.storageGetMs)),
    topKeys: samples[0].topKeys,
  }));

  const report = { label: LABEL, base: BASE, rounds: ROUNDS, table, rows, pageErrors };
  fs.writeFileSync(path.join(OUT, `tab-switch-${LABEL}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ label: LABEL, table, pageErrors }, null, 2));
  await browser.close();
}

main().catch((error) => {
  console.error('bench failed:', error);
  process.exit(1);
});
