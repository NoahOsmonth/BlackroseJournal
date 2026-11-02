/**
 * Shared page-side instrumentation for the UI benchmarks.
 *
 * Both `tab-switch-bench.mjs` and `route-mount-bench.mjs` need the same three
 * things from inside the page: storage traffic (AsyncStorage's web backend is
 * `localStorage`), `longtask` entries, and animation-frame gaps. They are kept
 * here so the two benches cannot drift into measuring different things.
 *
 * Everything in this file runs in the browser, not in Node: the exports are
 * serialised with `page.addInitScript` / `page.evaluate`.
 */

/** Runs before app code: counts storage traffic and records long tasks. */
export function instrument() {
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

/**
 * Start the rAF sampler; state lives on `window.__benchState`.
 *
 * `contentSelector` is optional. When given, the sampler also records the first
 * moment an element matching it is present and visible — that is what
 * `contentAtMs` reports for a cold mount, where there is no "route changed"
 * event to hang the measurement on.
 */
export function startSampling(options = {}) {
  const contentSelector = options.contentSelector || null;
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
    contentAt: null,
    // [{ t, skeleton, route }] whenever either changes.
    timeline: [],
  };
  window.__benchState = state;

  const isVisible = (el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const readState = () => {
    let skeleton = false;
    for (const el of document.querySelectorAll('[aria-label]')) {
      if (!/loading/i.test(el.getAttribute('aria-label') || '')) continue;
      if (isVisible(el)) {
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

    if (state.contentAt === null && contentSelector) {
      const el = document.querySelector(contentSelector);
      if (el && isVisible(el)) state.contentAt = Math.round(now - state.start);
    }

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

export function stopSampling() {
  const state = window.__benchState;
  state.sampling = false;
  const frames = state.frames.slice(1);
  const sorted = [...frames].sort((a, b) => a - b);
  const gaps = frames.map((gap) => Math.round(gap * 10) / 10);
  const storage = window.__benchStorage;
  const longTasks = window.__benchLongTasks;
  return {
    elapsedMs: Math.round(performance.now() - state.start),
    contentAtMs: state.contentAt,
    // `frames` is the count (what the switch/mount benches report); `gaps` is
    // the raw per-frame intervals, which the scroll bench needs to count drops.
    frames: frames.length,
    gaps,
    frameGapMaxMs: Math.round(sorted.length ? sorted[sorted.length - 1] : 0),
    frameGapP95Ms: Math.round(sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0),
    // The budget is on the longest single task, so that is what is reported.
    // `longTaskTotalMs` keeps the sum for context; it is not the budget metric.
    longTaskMaxMs: Math.round(longTasks.length ? Math.max(...longTasks) : 0),
    longTaskTotalMs: Math.round(longTasks.reduce((sum, d) => sum + d, 0)),
    longTasks,
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
export function summariseTimeline(timeline, destinationRoute) {
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
