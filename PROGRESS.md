# PROGRESS — Work Log

Record of what has been built, verified, and left open. One entry per effort,
newest last inside each era. **The full unreduced text of every entry through
2026-09-21 lives in this file's git history** (`git log --oneline -- PROGRESS.md`,
then `git show <commit>:PROGRESS.md`); this file was condensed to its durable
content on 2026-09-24.

---

## Current state (as of 2026-09-26)

**Blackrose** — a local-only React Native / Expo journal with an AI companion
that remembers on-device. No auth server, no cloud memory, no managed gateway:
every write lands in AsyncStorage under an account-scoped key, and chat talks
directly to an OpenAI-compatible provider with a user-supplied key.

| Area | State | Since | Where |
|---|---|---|---|
| Agent chat engine | Pi-class loop: tool shortlist → parallel pure reads → one mutating call per turn, idempotency, strict finality (status-only replies continue) | 2026-09-10 | `services/ai/agentLoop.ts`, `executeTool.ts`, `agenticGate.ts`; spec in `docs/compose/spec/` |
| Transport | OpenRouter removed; **provider profiles** (schema v2, several per device) replace the baked-in gateway — user-supplied base URL/key/model, no vendor host or model id in code | 2026-09-10/26 | `services/ai/customModels.ts`, `directConfig.ts` |
| Input handling | Bottom sheets and both chat composers ride above the soft keyboard with a concrete `KeyboardAvoidingView behavior` (Android 15+ edge-to-edge made `adjustResize` a no-op) | 2026-09-26 | `components/{entries,goals,intentions}/*Modal.tsx`, `app/chat.tsx` |
| Local-only build | Hindsight, Supabase, managed AI gateway, and the auth surface deleted; device-local account id instead | 2026-09-18 | `services/auth/localAccount.ts`; contract in `notes/local-only-storage.md` |
| Offline memory (Era 3) | File-semantic store with `_tmp` staging on finish; recall = intent gate → thread shortlist → manifest headers → top-K bodies, budgets 12k/file / 30k total / top-5 / 30s cache; a resolved thread's headers are merged with live `_tmp` **notes** (`type === 'note'`), and finish clears the recall cache | 2026-09-12 | `services/memory/memoryFiles.ts`, `memoryRetrieval.ts`; plan in `.planning/offline-memory/` |
| Consolidation | Idle Dream trigger (single-flight, never during a streaming turn) + fading + supersession with audit fields ("when unsure, keep separate") | 2026-09-16 | `memoryDreamTrigger.ts`, `memoryFade.ts`, `memorySupersession.ts` |
| Atom store | Sharded 8-way header+shards store, cap 400 (a storage bound in disguise) → 4000; corrupt shard is quarantined, not fatal | 2026-09-16 | `services/memory/localMemory.ts` (`schemaVersion: 4`; profile cap retires, never destroys) |
| Identity | Always-on core memory (`@rosebud_identity_profile`), contradiction → `pendingCandidate`, never auto-applied | 2026-09 | `services/memory/identityProfile.ts`, `identityExtraction.ts` |
| Explore write path | `/explore` ledger port; a note fans out to four stores (journal entry, atom, `'note'` memory file staged `_tmp`, day digest); recall proven live and verbatim | 2026-09-20/21 | `MemoryHubScreen.tsx`, `saveExploreNote` |
| Today/insights UX | Insight "More options" modal replaced by an in-card Action Dock (variant C), measured 44px targets | 2026-09-19 | `components/today/InsightActionDock.tsx` |
| Settings UX | Hairline list replaced by tonal bands (variant E), `band-*` tokens mixed 72% from the palette | 2026-09-19 | `SettingsAccordionSection.tsx`, `tailwind.config.js` |
| Radial menu / dock | Long-press write menu rebuilt as a real overlay (fixed geometry, scrim, touch-release bug); dock height constant corrected 96 → 64 | 2026-09-19 | `radial-menu.tsx`, `components/journal/BottomNav.tsx` |
| Threads | Memory-graph canvas gains a chrome dissolve so the stats strip reads as HUD on the art, not a grey slab | 2026-09-19 | `assets/memory-graph/engine.html`, `MemoryGraphStats` |
| QA program | 107 documented cases (97 active), 4 runs executed, DEF-001–017 all fixed; last dashboard 84 Pass / 0 Fail / 5 Blocked / 3 N/A / 5 Untested | 2026-10-07 | `QA-Plan.md`, `docs/qa/` |
| Baseline hardening | Android bundle −59.8% (icon barrel), 10 tested bug fixes (week keys, DST streaks, UTC dates, …), sse/streak/color-derivation coverage | 2026-09-02/03 | `scripts/analyze-bundle.mjs`, `__tests__/` |

Recall metrics on the frozen R0 ledger (`probes/shared/recallLedger.ts`):
hit-rate 16.7% → **83.3%**, precision 0.167 → **0.433**, thread selection
reproducible — the R1+R2 delta, stable across runs. Last full gate: **289
suites passed / 9 skipped (298 discovered), 1634 tests green** (25 skipped),
tsc / lint / `check:design` clean.

## Dated log

### 2026-11-02 — tab switching: measured, then fixed (issue #9)

The report was "Threads → Today stutters, other tabs are fast". Measured first,
with a new dock-switch bench (`scripts/qa/tab-switch-bench.mjs`) that presses a
dock tab inside a real Chromium page and samples animation-frame gaps, `longtask`
entries, storage traffic and the loading-skeleton window. Baseline `main` @
`55c8b9a`, 390×844, dark, demo seed, 3 rounds, medians:

| Pair | frameGapMax | longTask | storage reads |
|---|---|---|---|
| Threads → Today | 206 ms | 206 ms | 65 |
| Insights → Today | 172 ms | 169 ms | 65 |
| Archive → Today | 194 ms | 192 ms | 65 |
| Today → Threads | 61 ms | 62 ms | 0 |

Per-round spread was the real story: Threads → Today hit 206 / 544 / 167 ms and
Archive → Today 194 / 411 / 189 ms — over half a second of blocked main thread
in one long task. Today → Threads reads **zero** keys, which is why only the
*pair* felt different: the cost is paid on arrival at Today, not on leaving.

Four causes, all fixed:

- **Five hooks each flipped `isLoading = true` on every focus**, so each arrival
  tore the whole Today tree down to `TodaySkeleton` and rebuilt it after the
  read. `useJournalEntries`, `useIntentionCheckIns`, `useIntentions`,
  `useGoals` and `useSavedInsights` now keep a `hasLoadedRef` and only show the
  spinner on the first load (the pattern `useLocalMemories` already used),
  resetting it when the account id changes. `useSavedInsights` did not observe the
  active account at all before this change, so a guard alone would have kept the
  previous account's insights on screen; it now reads `useActiveAccountId`,
  clears the rows and reloads when it changes.
  *Honest limit of the measurement:* the bench never saw that skeleton painted —
  `skeletonShown` is 0 in **both** runs, because `AsyncStorage` on web resolves
  in a microtask, before the next frame. The flip is still a defect (a whole-tree
  unmount waiting on storage), and on a native device the same read crosses the
  bridge and does take painted milliseconds, but the 206 → 67 ms improvement is
  attributable to the read-count and render fixes below, **not** to a skeleton
  that was removed from the web frame.
- **Three lists cost three full loads.** `listDrafts()`/`listCompleted()` each
  re-read the index plus all 16 shards, and `listCompletedCheckIns()`/
  `listCheckInDrafts()` each call `listCheckIns()` again. Both hooks now read
  once and split in memory. Storage reads per switch: 65 → **21**.
- **Today re-read `@intention_checkins` in a tap handler.** This one was tried and
  **reverted on review**: `openDailyCheckIn` keeps its fresh
  `listCheckInDrafts()` read. The hook's `drafts` is a focus-time snapshot, so
  resuming from it can reopen a check-in that was completed since, or miss one
  just saved and start a duplicate. A tap is off the switch's measured frame
  path, so freshness wins over the saved read.
- **Duplicate hook instances on Archive.** `entries.tsx` mounted
  `useJournalEntries` + `useIntentionCheckIns` a second time just to count
  drafts. `useHistoryFeed` now returns `draftCount` and a composed `refresh`,
  and the screen uses one set.

Plus two render-cost fixes on the same path: `activeIntentions` in
`useIntentions` and `weeklyStats` in `useWeeklyInsights` were rebuilt in the
render body on every render (the latter re-splitting every word of the week);
both are `useMemo`'d. `weekDateRange` stays a render-body IIFE on purpose — it
reads the clock at render time.

Memoizing `weeklyStats` introduced a staleness bug that review caught: the memo
keyed only on `getWeeklyItems`, whose identity changes when the collections
change — not when the clock crosses a week boundary — so a screen left open kept
last week's counts under this week's label. The week filter now takes the week
start as a parameter and the memo depends on it, so stats and label read one
clock. `__tests__/hooks/useWeeklyInsightsWeekBoundary.test.tsx` pins it with fake
timers (sabotage-verified: without the dependency it reports the old week's
counts).

After, same bench and settings:

| Pair | frameGapMax | longTask | storage reads |
|---|---|---|---|
| Threads → Today | 67 ms | 66 ms | 21 |
| Insights → Today | 45 ms | 52 ms | 21 |
| Archive → Today | 67 ms | 67 ms | 21 |
| Today → Threads | 33 ms | 0 ms | 0 |

Threads → Today is **3.1× shorter** and the worst round dropped from 544 ms to
89 ms. The remaining ~45–70 ms task is React render work in the Today tree, not
storage — see the rules doc for why that is the next step and why it is a design
change, not a hook change.

- **`docs/perf/ui-performance-rules.md` (new)** — the "think outside the box"
  half of the issue: six rules (stale-while-refresh, one read per collection, one
  hook instance per collection, memoize derived collections, do not re-read in a
  handler what the hook holds, measure do not guess) and four budget tables. The
  first table holds for **every interaction** and is structural (1 read per
  collection per action, 1 load per collection on focus, 1 hook instance per
  collection per tree, 0 derived collections rebuilt in a render body, 0 spinner
  re-shows, 0 ms of blocking reads in a tap handler) — checkable by reading code.
  The second is measured and switch-scoped (≤100 ms longest task and frame gap,
  ≤16 ms p95 gap, 0 skeleton re-shows, ≤25 storage reads, ≤50 ms to route). A
  third table covers cold mounts, added after review pointed out that
  switch-only numbers do not answer "targets for all of the UI/UX". A fourth
  covers scrolling (0 long tasks, 0 storage reads per pass), added when a second
  review round said scrolling was still unmeasured.
- **`scripts/qa/route-mount-bench.mjs` (new)** — a cold mount is a different path
  from a switch (module init + first read + first render), so it needs its own
  numbers rather than being inferred from the switch bench. Loads each route in a
  fresh browser context and times until the route's content is visible. Current
  numbers, 3 cold loads each: Today 1401 ms to content / 231 ms longest task / 417
  reads; Threads 3942 ms / 223 ms / 383; Insights 993 ms / 221 ms / 398; Archive
  983 ms / 228 ms / 413. The budgets (≤300 ms task, ≤300 ms frame gap, ≤450 reads,
  ≤2000 ms to content on Today) are **ceilings set from these numbers, not
  achievements** — this branch changes no mount-path code, so there is no
  before/after to show. `contentAtMs` is load-to-dock-visible (the tab tree
  mounted), not "first row painted". Threads is the outlier at 2.3–4.1 s and its
  cause is **not diagnosed**: it is not storage (Threads reads 383 keys vs
  Today's 417) so it is in that screen's render path. Profiling it is the first
  follow-up. (An earlier draft blamed the memory-graph engine; `app/(tabs)/explore.tsx`
  renders `MemoryHubScreen`, a ledger list with no WebView, so that was wrong.)
- **`scripts/qa/scroll-bench.mjs` (new)** — the third path, and the last one that
  is app-side: what a screen feels like once it is usable. Wheel-scrolls each list
  top-to-bottom over ~1.6 s and records long tasks, storage reads and frame gaps.
  Budgets: **0** main-thread tasks ≥50 ms and **0** storage reads during a scroll
  pass. Measured, 3 passes per route: Threads 1438 px, Insights 424 px, Archive
  2243 px scrolled; 0 long tasks and 0 storage reads on every pass, 0 page errors
  — both budgets are met by the current code. **Frame gaps are reported but not
  budgeted**: headless Chromium has no vsync, so it ran ~400 frames in a 1600 ms
  pass (≈250 fps) and a "6 ms max gap" describes the harness, not the app.
  Certifying 60 fps needs a vsync'd target this repo does not run. The bench also
  **fails** if the scroll moved the page under 100 px, because the first version
  silently measured an idle page — RNW keeps the list in a `div` with
  `overflow-y: auto`, so `window.scrollY` stays 0 however far it scrolls.
  AI-request and chat-send latency remain unmeasured: both are dominated by the
  provider round-trip and there is no offline fixture that would make a number
  meaningful, so the structural table holds them.
- **`scripts/qa/bench-instrument.mjs` (new)** — the page-side instrumentation all
  three benches share (storage counting, `longtask` observer, rAF sampler), so they
  cannot drift into measuring different things. `stopSampling` returns both
  `frames` (a count) and `gaps` (the raw intervals the scroll bench needs).
- **`scripts/qa/chromium.mjs` (new)** — the installed `playwright-core` bundles a
  Chromium revision (`chromium_headless_shell-1208`) that is not on this machine,
  so `chromium.launch()` throws `Executable doesn't exist`. This resolves the
  newest cached `chromium-<rev>` build instead; `PW_CHROME_PATH` overrides.
- **`__tests__/hooks/collectionRefreshStaleness.test.tsx` (new, 6 tests)** —
  guards the two behaviours Jest can see: one storage read per collection (the
  status-splitting helpers are mocked to *throw* if called), the Archive draft
  count coming off one pair of instances, no `isLoading` flip during a refresh
  with data on screen, and the spinner still returning for a different account.
  Each "does not re-enter loading" test also asserts the read actually started, so
  a refresh that silently does nothing cannot pass.
- **`__tests__/hooks/collectionAccountAndWeekBoundary.test.tsx` (new, 2 tests)** —
  a `useSavedInsights` account change drops the previous rows and re-reads; no
  active account clears the rows and stops loading.
- **`__tests__/hooks/useWeeklyInsightsWeekBoundary.test.tsx` (new, 1 test)** —
  `weeklyStats` follows the clock into a new week.
- **Visual evidence**: the switch is a timing defect, so the PR carries the
  measured table above plus the exact capture commands. Screenshots of Today
  before and after are byte-identical (same hash) — the change is invisible in a
  still frame, which is exactly why a screenshot cannot be the evidence here.

Gates: `npx tsc --noEmit` clean, `npm run lint` 0 errors (78 warnings, all
pre-existing), `npm run check:design` 175 files OK, `npm test` 291 suites /
1646 tests green (9 suites skipped, unchanged).

### 2026-11-02 — SemVer, a changelog, and a release process

The repo had no version history to speak of: `package.json` and `app.json` both
said `0.0.1`, there was no `CHANGELOG.md`, no tag, and no documented way to cut
one. A release therefore had no definition beyond "build whatever is on main".

- **Version bumped 0.0.1 → 0.1.0 in both manifests** (`package.json` `version`,
  `app.json` `expo.version`). `0.1.0`, not `1.0.0`: the app is pre-1.0 by its own
  history (three design rewrites, a storage-schema migration in flight) and the
  issue asked for the first cut of a SemVer line, not a stability promise.
  `package-lock.json` keeps its own copy of the old version — lockfiles are on
  the do-not-touch list, and npm rewrites that field on the next install.
- **`CHANGELOG.md` added** in Keep a Changelog 1.1.0 form with `[Unreleased]`
  plus the `[0.1.0]` entry and both link refs. The entry describes the app as it
  ships now rather than replaying every commit: the local-only rebuild, memory
  layers, provider profiles, and the EAS-owned versionCode.
- **README: new "Versioning and releases" section** — where the version lives
  (both files, and why they must move together: Expo reads `app.json`, the
  Settings → About `v…` label reads it via `expo-constants`), how to cut
  `vX.Y.Z`, and the `appVersionSource: "remote"` + `autoIncrement` rule that
  keeps the Android `versionCode` on EAS. Existing sections kept; the title now
  matches the app name (`# blackrosejournal 📝`, was `JournalApp`).
- **`__tests__/versioning.test.ts` (new)** guards the parts that can drift
  silently: `package.json` version == `app.json` version, SemVer shape, the
  changelog's first released heading matching the package version with a link
  ref for every released tag, the README section stating its three facts, and
  `eas.json` keeping `appVersionSource: "remote"` with production
  `autoIncrement`. Sabotage-verified: bumping only `app.json` to `0.1.1` fails
  two tests, restore turns them green.
- **`appInfo.test.ts` mock no longer hardcodes the version** — it reads
  `app.json` instead of `'0.0.1'`, so the existing `APP_VERSION === pkg.version`
  assertion keeps meaning something after every bump. `constants/appInfo.ts`
  fallback and one `SettingsAccordionSection` fixture string followed the bump.

Not done, deliberately: no APK build (out of scope), and the `v0.1.0` tag +
release notes land **after** this PR merges — a tag on an unmerged branch would
point at a commit that never reaches `main`.

**Release cut (same day).** PR #6 merged as `5d21cff`; the annotated `v0.1.0` tag
was created on that merge commit and pushed, and the GitHub release published
from the tag annotation (`gh release create v0.1.0 --notes-from-tag`). Note
`--notes-from-tag` cannot be combined with `--repo`; run it from the checkout.

**Follow-up: Sourcery round-1 review fixes** (four 🟡 findings, all valid, all
landed after the merge because they were still in the working tree when #6
merged):

- README release steps gained an explicit *"Merge that commit to `main` before
  tagging"* step — a tag pushed from an unmerged branch publishes code that
  never reaches the default branch.
- The `constants/appInfo.ts` fallback literal is documented in the release steps
  and now has its own guard (extract the `?? '<version>'` literal, compare to
  `package.json`). Kept as a fallback rather than removed: it only applies when a
  runtime exposes no expo config, so deleting it would change behaviour.
- Changelog link refs are parsed as real Markdown definitions and must have a
  nonempty `http(s)` destination — the previous `toContain('[0.1.0]: ')` passed
  on a malformed or empty target.
- `SEMVER` tightened to forbid leading zeros (`01.1.0` is not a SemVer version).

All four sabotage-verified red then green. Gates: 290 suites / 1640 tests green,
tsc / lint / `check:design` clean.

**Follow-up: Sourcery round-2 review fixes on PR #7** (two 🟡 findings, both valid):

- The round-1 README step was not enough: `git switch main && git pull` pulls
  *from* the remote but does not push a locally merged commit, so
  `git push origin vX.Y.Z` could still publish a tag whose commit is absent from
  `origin/main`. The step now says to merge on the remote (or push) and verify
  reachability with `git merge-base --is-ancestor <commit> origin/main` before
  tagging.
- `LINK_DEFINITION` scanned the whole changelog, so a `[0.1.0]: https://…`
  example inside a fenced code block satisfied the check while the real
  definition was missing. `stripFencedCode()` now removes fenced blocks first.
  Proven load-bearing: with the strip neutralised, a changelog whose only
  definition sits in a fence passes 6/6; with it active the same input fails.

### 2026-10-07 — open follow-ups closed (round 2): retrieval gating, dock a11y, provider rename

Same day as run 4, a second pass closing the PLAN/PROGRESS follow-up list. Four
parallel lanes, then reconciled by the orchestrator. **All UNCOMMITTED.**

- **Item 2 — `memory_search` missed `_tmp` notes (fixed).** `memoryRetrieval.ts`'s
  `project_memory` branch scanned only the resolved thread, so a staged note was
  reachable only via the recency fallback (which runs only when *no* thread
  resolves). The candidate pool now merges the thread's headers with live `_tmp`
  **notes** (`header.type === 'note'`) via the existing `listTmpFiles()`, deduped
  by id. **Scoped to notes deliberately:** the first cut merged *all* `_tmp`
  files and dropped the R2 ledger's precision below its recorded R1 bar
  (`probes/r2RecallDelta` `precision > 0.4` → 0.3) — unpromoted `project`/
  `feedback` files are distractors until Dream promotes them. Caught by the probe,
  narrowed, probe green again. Also (part B) journal finish now calls
  `clearMemoryRecallCache()` after staging, so a just-staged note is recallable
  immediately rather than after the 30s TTL (mirrors `journalEntryActions.ts`).
- **Item 5 (a11y half) — insight Action Dock had no Escape / Android-back
  dismissal (fixed).** The dock is deliberately not a `Modal`, so it got none of
  `onRequestClose`. It now registers its own platform listener while mounted:
  `keydown`/Escape on web, `hardwareBackPress` on native. **Live-verified:**
  `More options` opens `role=menu`; Escape closes it. The optional label-shortening
  copy change is still a call for the owner.
- **Item 9 — baked-in model ids in the live integration tests (fixed).** Dropped
  the `?? 'tencent/hy3:free'` / `?? 'nvidia/nemotron-3-ultra-550b-a55b'`
  fallbacks from all three; each now fail-fasts naming
  `EXPO_PUBLIC_AI_CUSTOM_MODEL`. No baked-in model id remains outside dated history.
- **Item 10 — stale `UI_MAP.md` Account row (fixed).** The Settings Account row,
  the auth route row, the `Auth (login)` concept row, and the stale
  "redirects to forgot-password" capture note all still described the pre-2026-09-18
  auth surface; all corrected to the device-local account.
- **Item 11 — a model-less provider could not be renamed (fixed).** Added a
  model-independent `renameProfile` on `useCustomAiModels`, wired to the provider
  name field's `onBlur`. It never touches `enabled`/`selectedModelId`, so no
  "enabled but no model" state is possible. **Live-verified:** added a model-less
  provider, renamed it, reloaded — the name persisted; removed the probe profile
  and restored the active provider.
- **Item 6 — doc drift (fixed).** The explore spec's `design.md:227`-equivalent
  theme-drift section now describes the shipped mechanism (frame callback +
  divergence check + `IDLE_RESUME_MS`), not the pre-fix `onScrollBeginDrag` pause.
- **Live provider gate (item 7) re-checked.** The provider IS reachable
  (a real chat turn returned a reply), but the formal `RUN_INTEGRATION_TESTS`
  harness and the full offline recall probe both need the key in the env/`.env`
  seed, which is blank here — so they remain **blocked on a credential**, not on
  code. The offline **boot gate passes** (`E2E_BOOT_ONLY=1`): journal renders,
  0 blocked requests, 0 page errors, remembered account intact; and the offline
  probe's finish step stages a memory file with no network.
- **Still open by design:** item 3 (R3 — gated on a real-restatement ledger),
  item 4 (identity-store split — an unmeasured design question), item 8
  (`customModels` v1→v2 — device-only), item 5's label-shortening copy call.

Gates on the combined tree: `check:design` PASS, `tsc` 0, `lint` 0 errors / 78
warnings (unchanged), `jest` **289 suites / 1634 tests pass**, 25 skipped
(integration). New tests: staged-note recall + trace counts + the not-merged
negative case, recall-cache-clear on both finish paths, dock Escape/back, and
model-less rename.

### 2026-10-07 — full-UI QA pass with Playwriter (run 4): 3 defects found and fixed

A full-UI QA pass on the current build (`4538e66` + an uncommitted working tree) driven by Playwriter against the Expo web build. **14 QA cases executed — 12 Pass, 1 Blocked, 1 obsolete → N/A.** Pre-flight gates green: `check:design` PASS, `tsc` 0, `lint` 0 errors / 78 warnings, `jest` 289 suites / 1624 tests pass.

- **Three defects found, all fixed (UNCOMMITTED).**
  - **DEF-015** (S3) — Settings "About Blackrose" and "Privacy Policy" were silent no-ops on web: `app/(tabs)/settings.tsx` used `Alert.alert`, which react-native-web does not implement (same class as DEF-009). Now calls `notifyUser()`; the Drive backup/restore outcomes in `components/settings/DataManagementSection.tsx` likewise.
  - **DEF-016** (S4) — the `+` radial menu still carried the stale pre-rebrand label "Ask Rosebud"; now `Ask` (`components/journal/radial-menu.tsx`).
  - **DEF-017** (S2) — deleting a note from Threads left it searchable: only the atom shard was deleted while the `'note'` memory file and journal entry survived, so `memory_search` still returned it. Live store probe: pre-delete entryHits=3 / fileHits=1 / manifest header present → post-delete ALL 0. `hooks/memory/useLocalMemories.ts` `removeAtom` now routes `layer==='note'` atoms through `deleteJournalEntryWithTombstone(entryId)`; extracted atoms keep atom-only delete. **This is PLAN.md item 1.**
- **Tracker drift found.** The dashboard's "97 active" total counts the retired THEME-07 row (true active = 96), and SETTINGS-02 was stale — it tested the `freeOnly` concept deleted 2026-09-26 (AGENTS.md rule 9). SETTINGS-02 is now marked N/A and the dashboard recomputed from the CSVs to 84 Pass / 0 Fail / 5 Blocked / 3 N/A / 5 Untested.
- Run summary: `docs/qa/results/2026-10-07-run4.md`.

### 2026-10-04 — the memory system stopped destroying memories (rounds 2–3)

A two-round audit-then-repair pass over the whole on-device memory path. Every
claim below was reproduced on the **unfixed** tree first; three of this round's
own probes passed the wrong way and were repaired before being trusted.

- **The headline: the profile cap permanently deleted memories.** `localMemory.ts`
  kept a 3-slot profile cap that sorted by `(salience + confidence)` and
  `delete`d every atom past the third. Loss was permanent, `console.warn` only,
  invisible in the UI, and **unrecoverable from a backup** because the cap ran
  before any save or export. Measured: 5 topics written → 3 stored → **2
  destroyed, 2 unrecoverable**. It was the only one of the three memory stores
  that hard-deleted — `memoryFiles.ts` has `deprecated`, `identityProfile.ts`
  has `invalidatedAt`. It now matches them: **retire (`retiredAt`), never
  destroy**, `LOCAL_MEMORY_SCHEMA_VERSION` 3 → 4. After: 5 written → 5 stored →
  **none destroyed**, 5/5 recoverable, and the injected capsule still bounded
  (1200 chars). The cap was never wrong to limit what gets *injected*; it was
  wrong to destroy what gets *stored*.
- **`@journal_entries` was one AsyncStorage key**, so ~693 entries crossed
  Android's ~2 MB per-key ceiling. Measured at 900 entries: **2,480,181 bytes on
  a single key**. Now 16 shards + a lightweight index with a v1 → v2 migration:
  biggest key **192,939 B**, 17 keys — a 12.9× reduction.
- **A corrupt memory-file manifest was discarded in silence.** The payload is now
  preserved under `@blackrose_memory_manifest_corrupt` and announced
  (`preserved=true, warnings=1`).
- **CJK project ids could never become threads** — `normalizeProjectId` now
  keeps them (matching `slugify`); verified end-to-end
  `stageTmpMemory → promoteTmpRecord → listFormalProjectIds` →
  `["工作压力"]`.
- **Key-people eviction announced** (still destroys — see the decision below);
  15 submitted / 12 stored / **1 announcement** instead of a silent drop.
- **Two writes outside their own lock**: `localBackup` wrote `memoryFiles` keys
  directly, and `refreshJournalEntryMemoryFiles` spanned two lock sections
  (measured: 2 divergent files → 1). Both now route through the owning module.
- **`DirectConfigError` was retried like a transient failure** — 19 identical
  lines in one boot (7 memory-extraction + 6 digest + 6 identity). It now
  fail-fasts and prints once; transient errors still retry.
- **Found by the merge, not by a lane: `saveManualMemoryNote` lost a note.**
  The atom id was `note:${Date.now()}` at **millisecond** resolution, so two
  notes in the same millisecond produced one id and the first was silently
  merged away. Pre-existing at HEAD; only surfaced when the full suite ran
  (passes in isolation — the tell for a timing bug). Fixed with a monotonic
  sequence; the `note:` prefix must stay because `memoryProvenance` matches on
  it.
- **Decisions taken, not just bugs fixed.** (a) The profile cap still exists — it
  bounds injection, not storage. (b) Evicted key people are still destroyed, only
  announced: `invalidatedAt` means "superseded", not "evicted by a cap", and the
  facts path is pinned by an existing test. Both are behaviour, not defects —
  change them deliberately if wanted.
- **Verification.** Acceptance harness (`_work/probes/acceptance.mts`, run
  against the unfixed tree first): B1/B2/C1/C2 all FAIL before, all PASS after.
  Four sabotage checks (break → red → restore → green). Gates: tsc 0, lint 78/0,
  `check:design` 175 PASSED, **288 suites / 1619 tests / 0 failures** (baseline
  283 / 1584).
- **Not verified:** no AI provider is configured in this environment, so no live
  model call ran; the boot log's 19 → 0 `DirectConfigError` count is confounded
  (the demo seed may not have re-run) and is **not** claimed as proof — the unit
  test is, and it goes red when reverted. `RUN_INTEGRATION_TESTS` suites
  (9 suites / 25 tests) remain skipped.

### 2026-09-26 — provider profiles replace the baked-in gateway (+ the keyboard, and two hidden fields)

- **The app no longer knows any vendor's name.** `services/ai/customModels.ts`
  restructured to schema v2 (`enabled`, `activeProfileId`, `profiles[]` with
  per-profile baseUrl/apiKey/selectedModelId/flashModelId/models/
  `modelFilterPatterns`/fallbackModelIds); v1 flat records fold in on load and the
  storage key is unchanged. The four `EXPO_PUBLIC_AI_CUSTOM_*` vars are a
  **first-run seed only** — Expo inlines `EXPO_PUBLIC_*` at build time, so env
  physically cannot deliver runtime flexibility (measured: a probe reading the var
  returned `undefined` while an unrewritable read returned the mutated value).
  The saved profile is the source of truth.
- **Free-only deleted outright**: `FreeModelBadge`, `freeOnly`, `isFreeModelId`,
  `filterFreeModels`, `preferFreeModelId`, `FreeOnlyPill`,
  `resolveManagedToolCapability`, and the vendor constants
  (`DEFAULT_AI_BASE_URL`, `PREFERRED_FREE_MODEL_ID`, `FREE_WEB_PROVIDER_PREFIXES`,
  `BUILTIN_FREE_FALLBACK_MODELS`, `OPENROUTER_DEFAULT_BASE_URL`). Dropping
  `BUILTIN_FREE_FALLBACK_MODELS` is a bug fix, not a loss: the fallback pool is
  now the profile's own cached models instead of a hardcoded roster. The
  paid-endpoint cost warnings went with free-only, per the owner's call. Dated
  history (`PROGRESS.md`, `docs/qa/**`, `docs/superpowers/**`, `.planning/**`,
  `docs/plans/**`) keeps its OmniRoute mentions on purpose — scrubbing them would
  make the repo's history lie.
- **The render-test layer had been dark, and the ambient shell did it.**
  `babel-preset-expo` inlines `process.env.NODE_ENV` at *transform* time and this
  shell exports `NODE_ENV=production`, so React resolved to `react.production.js`
  (no `act`) and RN's `AnimatedProps` test guard was baked to `'production'` — a
  disabled `TouchableOpacity` then **threw** `Unable to locate attached view in
  the native tree` instead of degrading. This reads exactly like a React-19/RNTL
  version mismatch and is not one. Fixed at the top of `jest.config.js`, the only
  point early enough (`setupFiles` runs after transforms). It also un-froze
  `EXPO_PUBLIC_*` in tests, so six `directConfig` cases that were red at HEAD pass
  on their own merits. Guard: `AGENTS.md` changelog.
- **Guards added.** `__tests__/vendorLeakage.test.ts` fails if vendor gateway /
  model-roster / price-tier vocabulary reappears in shipped source (with a
  sanity assertion that the glob matches >100 files, so it cannot pass vacuously)
  — it caught a leftover NanoGPT doc comment on its first run. The dev harness
  (`probes/`, `scripts/e2e/providerHost.mjs`) derives the outbound host from env
  instead of hardcoding it.
- **Two user-reported defects, same root cause, found only by using the screen.**
  `Base URL` and `Provider name` both lived inside the collapsed `Advanced`
  block, so a provider could not be pointed anywhere or given a title at add
  time. Both moved to the main form (Provider name → API key → Base URL →
  Fetch/Save); `Advanced` keeps `Model filters`, fallback context tokens and
  manual model id. The existing tests could not see it because they pressed the
  Advanced toggle *before* looking, i.e. they encoded the old location; the new
  guard never opens Advanced and asserts `Model filter patterns` is absent while
  the two fields are present and wired. Verified on a real emulator, not just a
  browser (the Advanced-open signal in both the unit test and the QA harness had
  to move off `Provider name`, which is now permanently visible).
- **Known gap, deliberately left.** A provider with no model cannot be renamed
  persistently: `saveSettings` requires a selected model and
  `getActiveCustomModelConfig` throws on "enabled but no model selected", so
  relaxing it would create a state that breaks chat.
- **Keyboard, on Android 15+.** Edge-to-edge made `windowSoftInputMode=
  adjustResize` a no-op, so nothing lifted bottom-anchored content: the four
  action sheets (entry editor, goal editor, goal quick-add, feedback comment)
  sat behind the IME — including the goal sheet's `autoFocus` input — and both
  chat surfaces passed `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`,
  i.e. Android got `undefined`. Sheet backdrops are now
  `KeyboardAvoidingView behavior="padding"` and both composers pass a concrete
  behavior on every platform. The old guard asserted the *string* `behavior=`
  appeared, which passed while Android shipped `undefined`; it now checks the
  value, and `bottomSheetKeyboard.test.ts` scans every sheet (asserting it finds
  exactly the four known ones first).
- **Entry-detail actions were unreachable.** The header's title had
  `numberOfLines={1}` but no flex constraint, so a model-written long title ate
  the row and pushed Edit/Delete off-screen; `flex-1 px-3 text-center` matches
  what `app/intentions/detail.tsx` already did. The existing suite stayed green
  because RNTL renders without layout and cannot see "off-screen", so the guard
  is a source contract.
- **Gates.** `tsc --noEmit` clean · `npm run lint` 0 errors (81 pre-existing
  warnings) · `npm run check:design` PASSED · `npx jest --runInBand` **273
  passed, 9 skipped (282 discovered), 1490 tests, 0 failures**.
- **Offline boot re-verified with the seed blank** (rule 12): `E2E_BOOT_ONLY=1`
  and `E2E_OFFLINE_WALK=1` both PASS — 12 routes rendered, 0 blocked requests,
  0 page errors, `@blackrose_account_registry` intact, and the app's
  provider-unreachable copy is vendor-free.
- **Cross-platform hardening (both Windows and Linux are dev machines here).**
  Two suites had been green here and red on Windows in the same week:
  `metro-phosphor-resolve.test.ts` shelled out to `grep` (`execFile ENOENT`), and
  `bottomSheetKeyboard.test.ts` compared `path.relative()` output to
  forward-slash literals. Both are now portable, all repo-relative paths in tests
  go through `relPosix()` (`__tests__/mocks/repoPath.ts`), and
  `__tests__/crossPlatformGuards.test.ts` enforces the three rules (no POSIX-only
  spawns, no raw `path.relative` in tests, no absolute path from either OS),
  sabotage-verified both ways. Also recorded: no `.gitattributes` and
  `core.autocrlf` unset, with 8 tracked files already CRLF — so a guard test must
  not depend on line endings.
- **Chat screen redesigned to the Blackrose inline design (not Rosebud).** Turns
  are no longer bubbles: the writer's line sits in the flow at full width and the
  companion's is set off by a single 1px bone rule, on both surfaces
  (`components/ChatMessage.tsx`, `components/intentions/IntentionChatMessage.tsx`),
  pinned by `__tests__/chatPresentation.test.ts`. The microphone is gone; the
  speaker is now read-aloud (`hooks/chat/useReadAloud.ts`, expo-speech) and the
  only other control is photo attach (`services/ai/chatImage.ts` +
  `hooks/chat/useChatImagePicker.ts`). A photo persists as `uri`/`mimeType`/
  dimensions only — the bytes are re-derived per request via
  `resolveImageDataUrls`, because a 2 MP base64 blob would blow Android's per-key
  ceiling. The composer is pinned and rides the keyboard
  (`KeyboardAvoidingView behavior="padding"`), and the writing slip moved into the
  transcript (`components/chat/ChatTranscript.tsx`) so the input and both verbs
  stay in one reachable block.
- **Show-thinking is one persisted preference gating the whole work layer**, not
  just its detail: with it off, the summary line, the expand control, the
  reasoning and every tool row are absent together
  (`services/ai/chatViewSettings.ts`, `hooks/settings/useChatViewSettings.ts`).
  A streaming turn still shows its bare `Thinking` indicator — that is a loading
  affordance, not a tool trace, and it is asserted as such.
- **A finished turn's tool trace now survives a resume.** `sanitizeMessage`
  (`services/ai/sessionStorage.ts`) persisted `reasoning` but silently dropped
  `toolActivity`, so reopening a session lost the tool rows — found by expanding
  the layer in a real browser, fixed by round-tripping the typed snapshot array.
  Guard: `__tests__/services/ai/sessionStorageToolActivity.test.ts`.
- **The 500-line design gate forced real extraction, not reformatting.**
  `app/chat.tsx` 535 → 384 and `app/intentions/chat.tsx` 509 → 407 by moving
  finish orchestration into `hooks/chat/useJournalChatFinish.ts` and
  `hooks/intentions/useIntentionChatFinish.ts` and the transcript into
  `components/chat/ChatTranscript.tsx`.
- **Rendered-surface gate (rule: Jest green is not sufficient).** New committed
  harness `scripts/e2e/pw-chat-surface-verify.mjs` drives the real app at
  3 viewports × 2 schemes: 6 combinations, 6 distinct hashes, 0 page errors, and
  per-combination assertions on composer bottom vs viewport, document overflow,
  the three left edges (writer / rail / reply), reasoning colour and the icon row.
  `E2E_SABOTAGE=1` injects a microphone control and translates the composer past
  the fold — both guards are proven able to fail, without editing source.
  Measured rather than eyeballed: transcript bottom meets composer top at exactly
  0px, the desktop column is centred 496/496, and the placeholder renders at
  ≈5.3:1. Three confident vision-model "defects" (content behind the composer,
  off-centre column, invisible placeholder) were all false and were settled by
  the DOM.
- **Found while adding the missing coverage: read-aloud outlived its screen.**
  `useReadAloud`'s doc claimed speech is cleared on unmount but no unmount effect
  existed, so navigating away mid-reply kept talking. The new test was red first
  (`Speech.stop` never called), then the effect was added; the cleanup clears the
  utterance ref before stopping so a late `onDone` cannot touch state on an
  unmounted screen. New suites: `__tests__/services/ai/chatImage.test.ts`,
  `__tests__/hooks/useReadAloud.test.tsx`,
  `__tests__/hooks/useChatImagePicker.test.tsx` (38 tests) — the image send path
  and read-aloud previously had none.
- **Not verified, and not runnable here.** The live recall probe and
  `RUN_INTEGRATION_TESTS=1` need a reachable provider; the endpoint the owner
  removed now refuses TCP, so the provider-profile write path has unit coverage
  but no live-network confirmation. Clears by pointing the app at a reachable
  endpoint — no code change is pending on it.

### 2026-09-19/21 — design-variant ports + Explore write path

- **Insight Action Dock** (variant C of five audited prototypes): the overflow
  menu became a state of the card. Port deviated from the prototype in four
  measured ways (85px growth instead of overlay; `···` toggles; scoped
  tap-anywhere; opening scrolls clear of the nav). Key measurement: NativeWind
  compiles rem utilities against `inlineRem = 14` on native, so `h-11` is
  38.5pt — every touch-critical box uses literal px, asserted via
  `__tests__/mocks/tailwindCompile.ts`.
- **Settings tonal bands** (variant E): separation by surface value, open row
  promoted to `surface-*`, leading edge is an SVG gradient fade (a plain `View`
  can only paint a hard 1px rule). Found and fixed a pre-existing dark-mode
  bug: preset swatch bars read light slots unconditionally.
- **Threads stats strip**: the "grey background" was the canvas fading darker
  than the void under the dock; fixed with a `CHROME_FADE_H` chrome dissolve in
  the engine, strip rebuilt as a HUD rule. Separate fix: the dock clearance sat
  on a `flex-1` sibling (shrinks, does not move) — replaced with a last-child
  spacer and `BOTTOM_NAV_BASE_HEIGHT` 96 → 64.
- **DEF-014 + radial menu rewrite**: long-press navigated to chat because the
  Pressable under the gesture still fired; fixed with a `longPressFired` guard.
  The menu itself was rebuilt (measured stack layout, real Modal scrim,
  touch-release dismissal fix, staggered entrance, a11y).
- **Explore ledger port (T14)** + **write path (T16)**: see snapshot row above.
  T16 also fixed a real rendering defect: **NativeWind drops a `Pressable`'s
  function-style `style` on web** (fill and disabled opacity both vanish; Jest
  cannot see it because RNTL resolves the style first). Both affected CTAs now
  carry static style + pressed state; repo-wide guard:
  `__tests__/nativewindFunctionStyle.test.ts`.

### 2026-09-16/18 — the R-series (memory correctness, measured)

R0 built a frozen recall-measurement ledger; R1 gave Dream an idle trigger;
R2 added fading + supersession, priced on the ledger with a control thread so
over-firing (which *improves* the headline numbers) is caught. R2.1–R2.6 was a
sweep over one bug class — **silent bounds**: an unnamed cap in a callee
overriding the caller's explicit limit with nothing in the return value. Ten
instances fixed (memory_get clips, memory_flush stall, backup exporting ten
files, supersession's stacked fifties, …); every remaining cap is now named and
announced in its return value. Along the way: ids got collision-safe
(`idWithoutOverwriting`), supersession got priced with a restatement-vs-similarity
control, and the atom cap was measured to be a ~2MB AsyncStorage key limit
wearing a policy's clothes → sharded store, cap 400 → 4000. R3
(entity/alias → temporal → prospection) deliberately **not started** — gated on
measuring supersession's value on a real-restatement ledger (see follow-ups).

### 2026-09-17/18 — QA program + local-only rebuild

The formal QA program (`QA-Plan.md`, `docs/qa/`) was executed in three runs:
18 → 83 → 97 cases dispositioned; DEF-001–012 found and fixed across runs 2–3
(stop control through the chat stack, authored dates, composer draft autosave,
web confirm/download primitives, entry-detail edit/delete with tombstoned
projections, local-first clear/restore that survive a dead network). DEF-013:
the demo seed awaited 28 AI calls and looked frozen — now deterministic inside
`runWithDeterministicMemoryExtraction`, with visible per-row progress. Then the
**local-only rebuild** removed Hindsight/Supabase/the managed gateway and the
auth surface outright (account identity replaced, not migrated; the E2E probe
now blocks every host but the provider and reports any other outbound host as a
leak).

### 2026-09-09/10 — agentic tool-calling + plan docs

Tool-only long-term recall (send path never awaits; the model calls
`memory_search`/`recall` on demand, nudged by `HISTORY_TOOLS_POLICY`), then the
full executor discipline (exec classes, one mutating call, idempotency,
REFUSED-then-re-request), the Pi-class loop with strict finality
(status-only replies continue; spec: `docs/compose/spec/`), and the plan/research
docs under `docs/superpowers/` and `.planning/offline-memory/`.

### 2026-09-02/03 — baseline optimization + bug hunt

Bundle −59.8% by removing the `phosphor-react-native` barrel for per-family
`MaterialIcons` imports (Metro cannot tree-shake it), a bundle analyzer, and
ten tested bug fixes: `W00` week keys, DST-broken streaks, UTC date slips,
double-fired check-in side effects, stale reflections, weekly-cache
invalidation, duplicated intention goals, bare-weekday recall, and the
legacy-shim CI deadline.

## Open follow-ups (each named in the entry that raised it)

**Closed 2026-10-07 (round 2)** — note deletion, staged-note retrieval gating,
dock a11y, the explore-spec doc drift, the baked-in integration model ids, the
stale `UI_MAP.md` Account row, and model-less provider rename are all done; see
the round-2 entry above. What remains:

1. **R3 is gated, not forgotten.** Prerequisite: a real-restatement ledger
   (measuring how often a journal actually restates itself; the R0 ledger
   reports `superseded: 0` by design). Building temporal reasoning on
   entity resolution of unknown value is the exact move the R-series
   repeatedly declined.
2. **Identity-store split** — `get_identity` vs the offline user file: an
   unmeasured design question deliberately left open.
3. **Live provider gate — blocked on a credential, not on code.** The provider
   is reachable (a real chat turn returned a reply), but `RUN_INTEGRATION_TESTS=1`
   and the full offline recall probe both need the key in the env/`.env` seed,
   which is blank on this machine. Populate `.env` and re-run (AGENTS.md workflow
   step 7). The offline **boot** gate already passes
   (`E2E_BOOT_ONLY=1`: journal renders, 0 blocked requests, 0 page errors).
4. **`customModels` v1 → v2 migration is unit-tested only.** It has never run
   against a real device's stored v1 payload — device-only.
5. **Insight dock label shortening** — two labels can wrap and stagger the icon
   row (matches the approved prototype); shortening is a copy change that needs
   the owner's call. The a11y half (Escape / Android back) is done.

## Operational doctrine worth re-reading (distilled from the log)

- **Measurement before design.** Every variant port, cap change, and "is it a
  bug?" call above was settled by measuring the running app or a probe, not by
  reading code. Twice, measurement reclassified a "bug" as correct behavior.
- **A harness that cannot fail proves nothing.** Audit scripts carry a
  `selfTest()` (green case + deliberate sabotages); two false-defect reports and
  one false-pass were caught this way. Two more instances: a dropped assignment
  made a chip probe return `undefined`, skip every assertion and print a clean
  PASS (probes now fail loudly on zero matches), and a static scan needs a
  sanity assertion that its glob matched anything at all — an empty match set
  makes every later assertion vacuously true.
- **A test that encodes the old location cannot see the new one.** The
  provider-field defects (`Base URL`, `Provider name` hidden behind a collapsed
  `Advanced`) were invisible because the tests pressed the toggle before looking.
  Assert the user-visible contract (the field is present with the section
  *collapsed*), not the path the old code took.
- **Binary pulls over adb must use `exec-out`.** `adb shell cat` translates
  line endings: AsyncStorage's SQLite store reported btree errors and read as 0
  rows while the app plainly had data; `exec-out` returns `integrity_check: ok`.
- **Playwright harness traps**: auto-scroll before click silently undoes
  scroll setup; raw coordinate clicks hit overlays — target `role=` containers
  so interception fails loudly.
- **NativeWind native/web divergences** (both guard-tested now): rem utilities
  compile at `inlineRem = 14` on native; `Pressable` function-style `style` is
  dropped on web.
- **Supersession doctrine**: restatement (≥90% containment) only, control
  thread must survive, "when unsure, keep separate", notes are never superseded.
- **Budgets are load-bearing**: 12k/file, 30k total, top-5, 30s cache
  (`memoryRetrieval.ts`); every cap must be named and announced, never silent.
- **E2E gates live in AGENTS.md rules 7–9**: live Playwright for
  extraction/identity/recall work, cleared demo data for recall, offline-boot
  gate blocking every host but the provider. Jest green is not sufficient.

## Archive

Full unreduced entries (including every sabotage table, gate matrix, and
verbatim model reply): `git log --oneline -- PROGRESS.md` →
`git show <commit>:PROGRESS.md`. The condensation on 2026-09-24 dropped no
unique facts — only repetition, superseded intermediate states, and references
to since-deleted scratch artifacts.
