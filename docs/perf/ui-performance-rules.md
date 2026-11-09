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
`scripts/qa/route-mount-bench.mjs`. A change to what renders *inside* a scroll
container (a list row, an animation driven by `onScroll`) is measured with
`scripts/qa/scroll-bench.mjs`. "It feels faster" is not evidence; a screenshot
cannot show a dropped frame.

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

## What a cold-mount number is actually measuring (2026-11-09, round 71)

A cold mount in the dev server spends most of its long-task budget evaluating the
dev bundle, not running the app. Measured that round:

| Reading | Value |
|---|---|
| Dev bundle | 10.7 MB, 1,960 modules, 3.2 MB first-party across 485 files |
| Everything in localStorage after boot | **48 KB** |
| Longest task, cold mount | ~244 ms |

48 KB of storage cannot produce 244 ms of parsing. So the number is dominated by
module evaluation and first render, and **shrinking app data will not move it**. Two
things follow:

- Do not chase the cold-mount number with storage work. It was measured once as 876 ms
  of long tasks with a top key read 31 times, and that read is the deliberate
  freshness check in `localMemory` (one `getItem` per load, shards only on a miss) —
  worth a few milliseconds, not hundreds.
- Use the **tab-switch** bench for app-work regressions. It runs after the bundle is
  already evaluated, so it measures what this codebase actually controls. Its budget
  is ≤100 ms per switch, and `today -> explore` sits at the ceiling (117 ms before
  the round-71 hoist, 101 ms after) because the memory hub is a single big tree.

`lazy: true` on the tab navigator was measured that round and changed nothing
(876 → 834 ms, inside noise): the tab navigator already mounts on first focus.
These are ceilings with headroom over today's numbers, not achievements. A cold
mount has no prior paint to preserve, so it is judged on time-to-content rather
than on dropped frames.

The bench reports **two** milestones per route, measured in the same cold load
(QA run 18):

| Field | What it marks |
|---|---|
| `dockAtMs` | the route's dock tab is present and visible — the shell mounted |
| `contentAtMs` | that screen's **own** marker is present and visible — the writer can see their page |

`contentAtMs` is the one to quote. Each route names its marker in `ROUTES`
(`today-writing-card`, `theme-drift-strip`, a `mood-day-*` cell, `archive-search-button`),
chosen because the screen already renders it as real content, not chrome.

Before this change the bench waited on the dock alone, so it stopped at the
shell and under-reported every route. Measured 2026-11-08 on one build:

| Route | Dock | Content | Under-reported by |
|---|---|---|---|
| Today | 1361 ms | 1361 ms | 0 ms |
| Threads | 1100 ms | 1250 ms | 150 ms |
| Insights | 1099 ms | 1282 ms | 183 ms |
| Archive | 1089 ms | 1390 ms | 301 ms |

Today is unchanged because its writing card paints with the shell; the Archive
is worst because its list hydrates first. Quote **content**, not dock.

**Re-measured 2026-11-08 (QA run 11), which corrects the numbers above.** On the
current build the same bench reports Today 1290 ms, Threads 1079 ms, Insights
1059 ms, Archive 1056 ms. Threads is no longer an outlier and the 2.3–4.1 s
figures above are stale; anything that repeats them is quoting a measurement
that does not reproduce.

That run also showed the milestone is the weak part of the measurement, not only
the screen. Sampling Threads directly gave a skeleton at 381 ms and real content
(27 lines) at 488 ms — about twice as fast as the dock milestone it is scored
on — so the bench understates every route in this table. Two facts from it are
worth keeping:

- The screen is not slow to paint; the dock milestone is late. A per-screen
  "first row painted" selector is still not implemented, and it is the change
  that would make this table mean something.
- Nothing ghosts in: 27 content lines visible and 0 still faded at both 600 ms
  and 3100 ms, so no reveal animation is finishing after the page looks ready.

One real defect did surface during that sampling and is fixed: eighteen elements
on Threads were named "Loading" while the page was already drawn, because React
Native Web names a box after its file name and every `RevealItem` wrapper was
announced. See DEF-031 in `docs/qa/DEFECTS.md`; the reveal box now carries an
empty accessible name and `accessible={false}`.

No before/after pair is quoted for cold mounts: this branch changes no
mount-path code, so the honest reading is that the numbers are unchanged and the
budgets are newly *set*, not newly *met*. They exist so the next change to a
mount path has a ceiling to be judged against.

### Scrolling

The third path, and the last one that is app-side. A switch and a mount both
measure how long until a screen is usable; this measures what it feels like once
it is. Scrolling has no "done" moment, so there is no time-to-content to report.

| Metric | Budget | Why |
|---|---|---|
| Main-thread tasks ≥ 50 ms during a scroll pass | **0** | Any long task is a visible hitch under a finger |
| Storage reads during a scroll pass | **0** | A scroll must never re-read a collection |

Measured over 3 passes per route, top-to-bottom wheel scroll (`scroll-bench.mjs`):
Threads 1438 px, Insights 424 px, Archive 2243 px scrolled; **0 long tasks and 0
storage reads on every pass**, 0 page errors. Those two budgets are the ones that
matter and the current code meets them.

**Frame-gap numbers from this bench are not meaningful and are not budgeted.**
Headless Chromium has no vsync, so it runs animation frames as fast as it can —
the run recorded ~400 frames in a 1600 ms pass (≈250 fps), so a "6 ms max frame
gap" describes the harness, not the app. A real smoothness budget needs a vsync'd
target (a headed browser or a device), which this repo does not run in CI. The
bench still reports frame gaps because a large one is a real signal; it just
cannot certify 60 fps, and the doc does not pretend otherwise.

The bench also **fails** rather than reporting a clean profile if the wheel scroll
moved the page less than 100 px. That guard exists because the first version of
this bench silently measured an idle page: React Native Web puts the list in a
`div` with `overflow-y: auto`, so `window.scrollY` stays 0 no matter how far the
content scrolls, and the probe was reading the wrong element.

### AI requests and chat sends

These two have **no millisecond budget, deliberately**, and this section defines
how they are assessed instead of leaving a hole.

A switch, a mount and a scroll are all bounded by app code, so a number measures
the app. An AI request is bounded by the provider's round-trip: the same request
takes 400 ms or 40 s depending on the host, the model and the network. A budget
like "≤2 s to first token" would fail on a slow provider while the app is perfect,
and pass on a fast one while the app is doing wasteful work — it measures the
network, not this codebase. There is also no offline fixture: the repo has no
recorded provider stream, so the number would not be reproducible between runs.

So these paths are assessed structurally, which is the part the app does control:

| Metric | Budget | Why |
|---|---|---|
| Local work before the request is sent | **0 ms of blocking reads** | Reading a collection to build the prompt must not block the press (R5) |
| Collections re-read per send | **0** | The prompt is built from state the hook already holds (R2) |
| Storage reads triggered by one send | **1 per collection** | Same bar as every other interaction |
| Unchanged message rows re-rendered per streamed token | **0** | Append-only render, or the whole transcript re-renders per token |
| Spinner or placeholder re-shown after content arrived | **0** | The R1 flash, applied to a stream |

That table is checkable by reading the code, the same way the *Every interaction*
table is, and it catches the regressions this issue is about — blocking the main
thread, re-reading storage, re-rendering a list. What it does not do is predict
how long a provider takes, and no budget in this repo can.

**The re-render row was the one that failed when this table was first written.**
`ChatTranscript` renders `messages.map(...)` into a `ScrollView`, so before
`ChatMessage` was memoized every streamed token re-rendered every message row in
the conversation and the per-token cost grew with transcript length. `ChatMessage`
is now wrapped in `React.memo`; its props are primitives or refs the caller passes
through unchanged, so a settled row bails out and only the streaming row
re-renders. Theme changes still reach it, because `useColorScheme` and
`useThemeSettings` are subscriptions rather than props. The budget is held by
`__tests__/ChatMessage.test.tsx` → *ChatMessage memoization*, which was
sabotage-checked: unwrapping the memo makes the settled-row test fail (2 renders
where 1 is expected).

## Measuring

```bash
# one terminal: the app under test (hot reload must be on, so no CI=1)
npx expo start --web --port 8081

# another terminal — switches (the reported interaction)
BENCH_LABEL=after BENCH_ROUNDS=3 node scripts/qa/tab-switch-bench.mjs

# cold mounts (first load onto a route)
BENCH_LABEL=after BENCH_ROUNDS=3 node scripts/qa/route-mount-bench.mjs

# scroll passes (frame pacing and main-thread work while scrolling)
BENCH_LABEL=after BENCH_ROUNDS=3 node scripts/qa/scroll-bench.mjs
```

All three benches share their page-side instrumentation
(`scripts/qa/bench-instrument.mjs`) so they cannot drift into measuring different
things.

`scripts/qa/chromium.mjs` resolves a cached Chromium binary (`PW_CHROME_PATH`
overrides it) because the revision bundled with the installed `playwright-core`
may be absent. Results land in `output/perf/` (`tab-switch-<label>.json`,
`route-mount-<label>.json`, `scroll-<label>.json`, plus one screenshot per pair
or route); that directory is gitignored, so a report quotes the table and the
command rather than attaching the run.

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
