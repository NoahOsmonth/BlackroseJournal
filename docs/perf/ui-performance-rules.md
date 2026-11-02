# UI Performance Rules and Targets

The dock switches tabs without unmounting the screens, so every focus runs that
screen's refresh path on the main thread. When a refresh path re-reads a
collection several times, or tears the screen down to a skeleton while it does,
the press reads as a stutter even though the route change itself is instant.

These rules and budgets exist because Threads → Today was measurably the worst
switch (issue #9). They apply to every screen, not only that pair.

## Rules

**R1 — Stale-while-refresh.** A refresh must not re-enter the loading state once
the collection has loaded. Keep a `hasLoadedRef` (see
`hooks/journal/useJournalEntries.ts`) and only `setIsLoading(true)` when it is
`false`. Reset the ref when the account id changes — another account's rows are
not "already loaded" data.

On web the flip was never observed painted: the bench watched for a visible
`/loading/i` element through the whole switch window and saw none, because
`AsyncStorage` on web resolves inside a microtask, before the next frame. The
flip is still wrong — it is a full-tree unmount of the screen's content waiting
for a storage read — and on a native device, where the same read crosses the
bridge and takes real milliseconds, that wait is a painted skeleton. R1 removes
the risk rather than a measured web frame.

**R2 — One read per collection.** Ask a storage module for the collection once
and split it in memory. `listDrafts()` / `listCompleted()` and
`listCheckInDrafts()` / `listCompletedCheckIns()` each re-read the index plus
every shard, so calling three of them parses the same bytes three times:

```ts
// BAD — three full loads of @journal_entries
const [all, drafts, completed] = await Promise.all([
  listEntries(), listDrafts(), listCompleted(),
]);

// GOOD — one load, split in memory
const all = await listEntries();
const drafts = all.filter((entry) => entry.status === 'draft');
const completed = all.filter((entry) => entry.status === 'completed');
```

The status-filtered helpers (`listDrafts`, `listCompleted`, `listCheckInDrafts`,
`listCompletedCheckIns`) still exist for a caller that needs exactly one status
and nothing else — `services/ai/tools/*` uses `listCompletedCheckIns` that way.
A screen that needs two of them reads the collection once.

**R3 — One hook instance per collection per screen tree.** A screen that mounts
the same collection hook twice reads it twice and holds two copies that can
disagree. Compose instead: `useHistoryFeed` owns the journal and check-in hooks
and the Archive screen reads the composed result.

**R4 — Memoize derived collections.** Anything a render body builds from a hook
array (`filter`, `sort`, `Set`, a reduce) goes through `useMemo` with that array
as the dependency, or the screen rebuilds it on every unrelated state change —
including every loading-flag flip.

**R5 — A tap handler that *decides which record to open* reads fresh; one that
only *renders* uses the hook's data.** The distinction is authority, not cost. A
focus-time snapshot of `drafts` is a display cache: another screen can complete
or save a check-in between the last focus and the tap, and a snapshot has no way
to know. Opening from the snapshot then resumes a record that is already
completed, or misses one that was just saved and starts a duplicate.

```ts
// BAD — the snapshot may not contain what the tap needs
const draft = checkInDrafts.find(...);
router.push({ pathname: '/intentions/chat', params: { draftId: draft.id } });

// GOOD — the decision reads storage
const drafts = await listCheckInDrafts();
const draft = drafts.find(...);
```

This is not a performance exception to R2: a tap is off the measured frame path,
and the switch budgets are about what a *focus* costs. Do not generalize this
into "handlers may re-read collections" — a handler that renders a list on every
press is still a defect.

**R6 — Measure, do not guess.** A change to a tab screen's refresh path or to a
collection hook is measured with `scripts/qa/tab-switch-bench.mjs` before and
after. A change to anything on a screen's first-load path — module init, an
engine booting, a provider mounting — is measured with
`scripts/qa/route-mount-bench.mjs`. "It feels faster" is not evidence; a
screenshot cannot show a dropped frame.

## Budgets

### Every interaction

These hold for any user-visible interaction in the app, not just a tab switch.
They are the bar a new screen or handler is held to, and they are checkable by
reading the code — no bench required, which is why they are structural rather
than millisecond-based.

| Metric | Budget | Why |
|---|---|---|
| Storage reads triggered by one user action | **1 per collection** | A second read of the same key is the defect R2 names |
| Collections read on a focus path | **1 load each** | `listDrafts` + `listCompleted` is two full parses of one key |
| Hook instances per collection per screen tree | **1** | A second instance is a second full load (R3) |
| Derived collections rebuilt in a render body | **0** | `filter`/`map` over a collection belongs in `useMemo` (R4) |
| Loading spinner re-shown once data has loaded | **0** | This is the "it reloaded" flash (R1) |
| Main-thread work added inside a tap handler | **0 ms of blocking reads** | A handler may read for freshness, but must not re-read to render (R5) |

### Tab switches

Measured on a desktop Chromium at 390×844 (device scale 2), dark theme, demo
seed, three rounds per pair; the numbers are medians. A phone is slower in
absolute terms, so treat these as *ratios and ceilings*, not as phone timings.

| Metric | Budget | Why |
|---|---|---|
| Longest main-thread task in the switch window | **≤ 100 ms** | Past ~100 ms the press visibly drops frames |
| `frameGapMax` in the switch window | **≤ 100 ms** | Same budget, measured on the animation clock |
| `frameGapP95` | **≤ 16 ms** | A sustained jank tail, not one hitch |
| Loading skeleton re-shown after the first load | **0** | This is the "it reloaded" flash (R1) |
| Storage reads per tab switch | **≤ 25** | One load per collection plus the journal's 16 shards |
| Route selected after the press | **≤ 50 ms** | The route change itself is not the bottleneck |

A switch that breaks a budget is a regression even if every test is green: none
of this is visible to Jest.

### Cold mounts

The other half of the picture, and a genuinely different path: a fresh page load
straight onto a route — a deep link, a reload, or the first launch after the
splash. It pays module init, the first read of every collection and the first
render, so it is several times a switch and must not be judged by the switch
budgets above. Same bench settings; medians of three cold loads.

Measured on this branch (`route-mount-bench.mjs`), which is the baseline the
budgets are set from:

| Route | Content visible | `frameGapMax` | Longest task | Storage reads |
|---|---|---|---|---|
| Today | 1401 ms | 228 ms | 231 ms | 417 |
| Threads | 3942 ms | 222 ms | 223 ms | 383 |
| Insights | 993 ms | 222 ms | 221 ms | 398 |
| Archive | 983 ms | 228 ms | 228 ms | 413 |

| Metric | Budget | Why |
|---|---|---|
| Longest main-thread task during a cold mount | **≤ 300 ms** | The current worst is 231 ms; this is the ceiling, not a target |
| `frameGapMax` during a cold mount | **≤ 300 ms** | One dropped-frame cluster while the screen paints |
| Storage reads during a cold mount | **≤ 450** | Every collection loads once; well past that is a duplicate read |
| Content visible on Today | **≤ 2000 ms** | Beyond ~2 s a cold open reads as broken |

These are ceilings with headroom over today's numbers, not achievements. A cold
mount has no prior paint to preserve, so it is judged on time-to-content rather
than on dropped frames. Threads at 3942 ms is the outlier and the first thing to
fix; it is not fixed here because the cause (the memory-graph engine
initialising on first paint) is a rendering change, not a hook change.

No before/after pair is quoted for cold mounts: this branch changes no
mount-path code, so the honest reading is that the numbers are unchanged and the
budgets are newly *set*, not newly *met*. They exist so the next change to a
mount path has a ceiling to be judged against.

## Measuring

```bash
# one terminal: the app under test (hot reload must be on, so no CI=1)
npx expo start --web --port 8081

# another terminal — switches (the reported interaction)
BENCH_LABEL=after BENCH_ROUNDS=3 node scripts/qa/tab-switch-bench.mjs

# cold mounts (first load onto a route)
BENCH_LABEL=after BENCH_ROUNDS=3 node scripts/qa/route-mount-bench.mjs
```

Both benches share their page-side instrumentation (`scripts/qa/bench-instrument.mjs`)
so they cannot drift into measuring different things.

`scripts/qa/chromium.mjs` resolves a cached Chromium binary (`PW_CHROME_PATH`
overrides it) because the revision bundled with the installed `playwright-core`
may be absent. Results land in `output/perf/` (`tab-switch-<label>.json`,
`route-mount-<label>.json`, plus one screenshot per pair or route); that directory
is gitignored, so a report quotes the table and the command rather than attaching
the run.

The benches wrap `Storage.prototype.getItem/setItem` before app code runs, record
`longtask` entries through a `PerformanceObserver`, and sample animation-frame
gaps with `requestAnimationFrame` while a `[aria-label]` matching `/loading/i` is
on screen. They drive the app by accessible name (dock tab labels), so they fail
loudly if those labels change.

By default the switch bench measures **arrivals at every dock destination**
(Threads, Insights and Archive → Today, and Today → each of them), so a regression
on any tab's refresh path shows up rather than only on the pair issue #9
reported. Narrow it with `BENCH_PAIRS=explore>today,today>explore`; an unknown tab
name throws. The mount bench loads each route in a **fresh browser context** (no
warm module cache) and times until the route's dock tab is present and visible;
narrow it with `BENCH_ROUTES=today,explore`.

## Baseline and current numbers

Baseline: `main` at `55c8b9a`. Current: the optimization branch.

| Pair | `frameGapMax` before → after | `longTask` before → after | Storage reads before → after |
|---|---|---|---|
| Threads → Today | 206 → **67 ms** | 206 → **66 ms** | 65 → **21** |
| Insights → Today | 172 → **45 ms** | 169 → **52 ms** | 65 → **21** |
| Archive → Today | 194 → **67 ms** | 192 → **67 ms** | 65 → **21** |
| Today → Threads | 61 → **33 ms** | 62 → **0 ms** | 0 → 0 |

The `longTask` column is the **summed** long-task time, which is what the bench
recorded when these runs were captured; it now reports `longTaskMaxMs` (the
budget metric) and `longTaskTotalMs` (the sum) separately. On a switch this short
the two agree to within a millisecond.

Per-round spread before the fix was wide — Threads → Today measured 206 / 544 /
167 ms and Archive → Today 194 / 411 / 189 ms, i.e. occasionally more than half a
second of blocked main thread. After the fix the spread is 61–89 ms.

## Known remaining work

- The switch still runs **one ~45–70 ms task**, now dominated by React render
  work in the Today tree rather than storage: the read count is down to one load
  per collection and the remaining reads are the journal's index plus shards.
  Getting under the 100 ms budget was the goal; halving it again means making the
  Today tree cheaper to render (fewer wrapper views, fewer per-item animations),
  which is a visual-design change and out of scope for this rule set.
- `journalStorage.listEntries()` reads the index twice per load (`ensureMigrated`
  then `loadStore`). Worth one key read; not worth a refactor until a profile
  shows it mattering.
