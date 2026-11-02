/**
 * Dock tab-switch benchmark.
 *
 * Measures what a person feels when a dock tab is pressed, from inside the page:
 *
 *   - `skeletonMs`     how long a loading skeleton stays painted after the press
 *   - `routeAtMs`      press -> the destination route is selected
 *   - `longTaskMs`     main-thread tasks >= 50 ms inside the window
 *   - `frameGapMaxMs`  worst single animation-frame gap in the window
 *   - `storageGet`     localStorage reads (AsyncStorage's web backend)
 *
 *   node scripts/qa/tab-switch-bench.mjs
 *
 * Env: EXPO_WEB_URL, BENCH_OUT, BENCH_ROUNDS, BENCH_LABEL.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { launchOptions } from './chromium.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const BASE = (process.env.EXPO_WEB_URL || 'http://localhost:8081').replace(/\/$/, '');
const OUT = process.env.BENCH_OUT || path.join(ROOT, 'output', 'perf');
const LABEL = process.env.BENCH_LABEL || 'run';
const ROUNDS = Number(process.env.BENCH_ROUNDS || 3);

/** Dock labels in render order. */
const TABS = {
  today: 'Today',
  explore: 'Threads',
  insights: 'Insights',
  entries: 'Archive',
};

/** The reported slow pair first, then the pairs the report calls fast. */
const PAIRS = [
  ['explore', 'today'],
  ['insights', 'today'],
  ['entries', 'today'],
  ['today', 'explore'],
];

/** Runs before app code: counts storage traffic and records long tasks. */
function instrument() {
  const stats = { get: 0, set: 0, getMs: 0, setMs: 0, keys: {} };
  const rawGet = Storage.prototype.getItem;
  const rawSet = Storage.prototype.setItem;
  Storage.prototype.getItem = function countedGet(key) {
    const started = performance.now();
    const value = rawGet.call(this, key);
    stats.get += 1;
    stats.getMs += performance.now() - started;
    stats.keys[key] = (stats.keys[key] || 0) + 1;
    return value;
  };
  Storage.prototype.setItem = function countedSet(key, value) {
    const started = performance.now();
    rawSet.call(this, key, value);
    stats.set += 1;
    stats.setMs += performance.now() - started;
    stats.keys[key] = (stats.keys[key] || 0) + 1;
  };
  window.__benchStorage = stats;
  window.__benchLongTasks = [];
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__benchLongTasks.push(Math.round(entry.duration));
      }
    }).observe({ entryTypes: ['longtask'] });
  } catch {
    // longtask is Chromium-only; frame gaps measure the same jank.
  }
}

/** Start the rAF sampler; state lives on `window.__benchState`. */
function startSampling() {
  const storage = window.__benchStorage;
  storage.get = 0;
  storage.set = 0;
  storage.getMs = 0;
  storage.setMs = 0;
  storage.keys = {};
  window.__benchLongTasks = [];

  const state = {
    start: performance.now(),
    sampling: true,
    frames: [],
    // [{ t, skeleton, route }] whenever either changes.
    timeline: [],
  };
  window.__benchState = state;

  const readState = () => {
    let skeleton = false;
    for (const el of document.querySelectorAll('[aria-label]')) {
      if (!/loading/i.test(el.getAttribute('aria-label') || '')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        skeleton = true;
        break;
      }
    }
    const selected = document.querySelector('[aria-selected="true"]');
    const route = selected
      ? (selected.getAttribute('aria-label')
          || (selected.textContent || '').replace(/[^A-Za-z]/g, '')).toLowerCase()
      : null;
    return { skeleton, route };
  };

  let last = performance.now();
  let previous = null;
  const tick = (now) => {
    state.frames.push(now - last);
    last = now;
    const current = readState();
    const signature = `${current.skeleton}|${current.route}`;
    if (signature !== previous) {
      state.timeline.push({ t: Math.round(now - state.start), ...current });
      previous = signature;
    }
    if (state.sampling) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function stopSampling() {
  const state = window.__benchState;
  state.sampling = false;
  const frames = state.frames.slice(1);
  const sorted = [...frames].sort((a, b) => a - b);
  const storage = window.__benchStorage;
  return {
    elapsedMs: Math.round(performance.now() - state.start),
    frames: frames.length,
    frameGapMaxMs: Math.round(sorted.length ? sorted[sorted.length - 1] : 0),
    frameGapP95Ms: Math.round(sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0),
    longTaskMs: window.__benchLongTasks.reduce((sum, d) => sum + d, 0),
    longTasks: window.__benchLongTasks,
    timeline: state.timeline,
    storageGet: storage.get,
    storageSet: storage.set,
    storageGetMs: Math.round(storage.getMs),
    topKeys: Object.entries(storage.keys)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6),
  };
}

/** Press -> skeleton shown/cleared, and press -> destination route selected. */
function summariseTimeline(timeline, destinationRoute) {
  let skeletonStart = null;
  let skeletonEnd = null;
  let routeAt = null;
  for (const entry of timeline) {
    if (entry.skeleton && skeletonStart === null) skeletonStart = entry.t;
    if (!entry.skeleton && skeletonStart !== null && skeletonEnd === null) skeletonEnd = entry.t;
    if (routeAt === null && entry.route === destinationRoute) routeAt = entry.t;
  }
  return {
    skeletonMs: skeletonStart === null ? 0 : (skeletonEnd ?? 0) - skeletonStart,
    skeletonShown: skeletonStart !== null,
    routeAtMs: routeAt,
  };
}

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
        longTaskMs: sample.longTaskMs,
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
    longTaskMs: median(samples.map((s) => s.longTaskMs)),
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
