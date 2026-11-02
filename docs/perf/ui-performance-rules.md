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

**R5 — Do not re-read in a handler what the hook already holds.** A press
handler that awaits `listCheckInDrafts()` to decide which check-in to open adds a
storage round trip and a state update to a tap. Read the hook's `drafts`.

**R6 — Measure, do not guess.** Any change to a tab screen's refresh path or to
a collection hook is measured with `scripts/qa/tab-switch-bench.mjs` before and
after (see below). "It feels faster" is not evidence; a screenshot cannot show a
dropped frame.

## Budgets

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

## Measuring

```bash
# one terminal: the app under test (hot reload must be on, so no CI=1)
npx expo start --web --port 8081

# another terminal
BENCH_LABEL=after BENCH_ROUNDS=3 node scripts/qa/tab-switch-bench.mjs
```

`scripts/qa/chromium.mjs` resolves a cached Chromium binary (`PW_CHROME_PATH`
overrides it) because the revision bundled with the installed `playwright-core`
may be absent. Results land in `output/perf/` (`tab-switch-<label>.json` plus one
screenshot per pair); that directory is gitignored, so a report quotes the table
and the command rather than attaching the run.

The bench wraps `Storage.prototype.getItem/setItem` before app code runs, records
`longtask` entries through a `PerformanceObserver`, and samples animation-frame
gaps with `requestAnimationFrame` while a `[aria-label]` matching `/loading/i` is
on screen. It presses the dock tabs by accessible name, so it fails loudly if the
dock's labels change.

## Baseline and current numbers

Baseline: `main` at `55c8b9a`. Current: the optimization branch.

| Pair | `frameGapMax` before → after | `longTask` before → after | Storage reads before → after |
|---|---|---|---|
| Threads → Today | 206 → **67 ms** | 206 → **66 ms** | 65 → **21** |
| Insights → Today | 172 → **45 ms** | 169 → **52 ms** | 65 → **21** |
| Archive → Today | 194 → **67 ms** | 192 → **67 ms** | 65 → **21** |
| Today → Threads | 61 → **33 ms** | 62 → **0 ms** | 0 → 0 |

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
