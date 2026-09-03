# PROGRESS — Optimization + Bug Hunt (2026-09-02)

## 2026-09-03 — Untested-path coverage + launch/input UX papercuts

### Risk-focused tests (production paths that had zero direct coverage)

| Path | Risk | Coverage added |
|---|---|---|
| `utils/streak.ts` + `utils/streakStats.ts` | Streaks drive Today + streak-view; DST/day-boundary bug class already bit `useAchievements` | `__tests__/utils/streakStats.test.ts`: TZ-offset bucketing, gap/duplicate/month-boundary semantics, calendar padding + leap Feb |
| `services/theme/colorDerivation.ts` | Color Studio derives dark/light partners from user colors | `__tests__/services/theme/colorDerivation.test.ts`: round-trips, clamping, partner targets (l=70/38), neutral softening, invalid input |
| `services/ai/sseParser.ts` | Core chat streaming path; only error paths were covered | `__tests__/services/ai/sseParser.test.ts`: chunk-split JSON, `[DONE]` in buffer at EOF, usage callback, reasoning-only rejection, non-streaming fallback, `buildResponseError` shapes |
| `services/happiness-recipe/happinessRecipeStorage.ts` | Account-bound read-modify-write storage (rule 4) with remote queue | `__tests__/services/happiness-recipe/happinessRecipeStorage.test.ts`: serialized concurrent adds, habit dedupe, completedAt semantics, corrupt-payload fallback, account isolation, remote hydrate |

### UX papercuts fixed (each verified + tested)

1. **Launch landed on History instead of Today.** `app/index.tsx` redirected to
   `/(tabs)/entries` although Today is the first tab and the daily home. Now
   redirects to `/(tabs)/today`. Test: `__tests__/app/launchRedirect.test.ts`.
2. **`InlineTypingInput` logged `[ITI]` debug `console.warn` on every web Enter/
   submit** — leftover scaffolding removed. Test:
   `__tests__/components/InlineTypingInput.test.tsx` (trim/clear/disabled/no-warn).
3. **`useRef<null | any>` in login/signup** replaced with typed `TextInput` refs
   (repo bans `any`; `AuthInput` forwards `TextInput` refs). Type-level change —
   no behavioral test feasible, covered by `tsc`.

### Gates
`npx tsc --noEmit` ✅ · `npm run lint` 0 errors ✅ · `npm run check:design` ✅ ·
full jest 246 suites / 1188 tests ✅ (19 existing skips, integration-gated).

### Notes
- Backend deps were missing in this sandbox (`express`/`cors` unresolved in lint
  + root tsc); `cd backend && npm install` repaired it. Both `backend` tsconfig
  and root tsc now green.
- HSL round-trips are intentionally ±2 RGB channels (integer-percent rounding);
  the pipeline is for partner derivation, not lossless color archiving.
- Jest still prints its usual "did not exit" open-handle notice on full runs
  (pre-existing, unrelated to these changes).

---

# PROGRESS — Optimization + Bug Hunt (2026-09-02)

Solo-harness deep-work pass. Goal: ≥50% optimization, then 10–25 tested bug fixes
(no security), all gates green, E2E via playwriter at the end.

## Phase A — Optimizations (DONE, bundle −59.8%)

Android JS bundle measured via `expo export --platform android --dump-sourcemap`:

| Step | Bundle | Δ |
|---|---|---|
| Baseline | 10.54 MB (+ phosphor 5.6MB, vector-icons 0.55MB) | — |
| Remove `phosphor-react-native` → MaterialIcons subpath | 4.65 MB | −55.9% |
| Per-family `@expo/vector-icons/<Family>` imports (67 files codemod) | 4.22 MB | −59.8% |

Root cause: Metro cannot tree-shake `phosphor-react-native`'s 3,027-module icon
barrel (>50% of bundle). All glyph usage swapped to already-bundled MaterialIcons.

**Guards added / updated:**
- `__tests__/metro-phosphor-resolve.test.ts`: bans phosphor dep + Metro remap +
  ensures `newArchEnabled`; added barrel-import banishment (grep for
  `from '@expo/vector-icons'` must be empty).
- Component icon mocks repointed from the `@expo/vector-icons` barrel → `@expo/vector-icons/MaterialIcons`.
- `scripts/analyze-bundle.mjs`: source-map bundle-composition analyzer (added
  `node:buffer` import → the 2 lint errors are gone).

**Gates:** `tsc`, `lint` (0 errors), `check:design` (0 errors), full jest, backend
`tsc` — all green.

## Phase B — Bug hunt (DONE, 10 bugs, each with a test)

1. **legacy-shim deadline expired → CI guard failing daily.**
   `NANO_GPT_*` is still the active runtime path, but `AI_LEGACY_SHIM_DEPRECATION_DATE
   = 2026-09-01` passed, so `scripts/check-legacy-shim.js` exited 1 in CI every run.
   **Fix:** extend deadline to `2027-01-01` in `backend/src/config/aiShim.ts`; updated
   `__tests__/legacy-shim.test.ts`.

2. **`getCurrentWeekKey` emits invalid `W00` and splits the year-boundary week.**
   `weeklyInsightsStorage.ts` computed the week number from a naive `startOfWeek − Jan 1`
   diff → `2026-W00`/`2027-W00` at year start, and the Dec 27 2026 → Jan 2 2027 week
   resolved to `W53` one day and `W01` the next (two cache keys for one week).
   **Fix:** anchor the label year to the week's Thursday and window-anchor week 1 to the
   Sunday on/before Jan 1 → stable `2026-W53`, no `W00`.
   Test: `__tests__/services/insights/weeklyWeekKey.test.ts`.

3. **"What did I do last week/month?" resolved to the last 3 days instead of the window.**
   `historyPrefetch.ts`: `detectHistoryIntent` matched `last week|last month|this week`, but
   `extractDateHints` resolved only weekday/ISO tokens → empty keys → fell back to the most
   recent 3 days, ignoring the requested span.
   **Fix:** `RELATIVE_RANGE_RE` expands week/fortnight/month/year phrases into window day
   keys; `buildRetrievedHistoryContext` scans the whole window newest-first.
   Test: `__tests__/services/ai/historyRangeRecall.test.ts`.

4. **`useAchievements` longestStreak breaks across DST.** It tested `getTime()/86400000 === 1`;
   a DST-transition day is 23/25 h, so a 5-day streak across the boundary read as 4.
   **Fix:** compare local calendar y/m/d (month/year wrap safe) in `hooks/achievements/useAchievements.ts`.
   Test: `__tests__/hooks/useAchievements.test.tsx` (TZ-forced).

5. **`askRosebud.formatEntry` emitted UTC dates.** `toISOString().slice(0,10)` slips a day for
   a UTC+8 user writing near local midnight → AI told "yesterday" instead of "today".
   **Fix:** `getLocalDateKeyFromTimestamp`.
   Test: added to `__tests__/services/ask-rosebud/askRosebud.test.ts` (TZ-forced).

6. **`updateCheckIn` re-ran the completed-finish side effects on ANY edit of a completed
   check-in.** Routine title/mood edits re-extracted identity, re-built the session digest,
   and double-retained to Hindsight (status was still `completed`).
   **Fix:** only fire `runCompletedCheckInSideEffects` on the draft→completed transition.
   Test: added to `__tests__/services/intentions/intentionsStorage.test.ts`.

7. **`useEntryReflection.refresh()` was a no-op for cached entries.** The module cache was
   never invalidated, so edited entries kept stale reflections and "Regenerate" did nothing.
   **Fix:** `refresh()` forces regeneration (bypasses the cache).
   Test: `__tests__/hooks/useEntryReflection.test.tsx` (cross-mount cache + forced refresh).

8. **Weekly-insights cache never invalidated on same-count edits.** Validation was
   `entryCount === weeklyItems.length`, so editing an entry's text within the week left a
   stale AI summary forever.
   **Fix:** added `contentHash` to `CachedWeeklyInsights` + `computeWeeklyContentHash`
   (digest of created timestamps + all message contents), compared on read; legacy records
   still fall back to the count. Wired through `weeklyInsightsRemote` (`content_hash`).
   Tests: `__tests__/services/insights/weeklyInsightsContentHash.test.ts`; existing hook
   test mock updated.

9. **Refine-finish duplicated an intention goal.** `markIntentionGoalComplete` fired on every
   finish when `checkInType === 'intention'`, including refine mode (which updates the
   intention without producing a completed check-in) → a fresh duplicate green goal each time.
   **Fix:** extracted `shouldMarkIntentionGoalComplete` (gate on non-null check-in) and used it.
   Test: added to `__tests__/services/intentions/intentionChatCompletion.test.ts`.

10. **Bare weekday resolved 7 days back on its own weekday.** `resolveRelativeDateKey('monday')`
    asked on a Monday returned last week's Monday (delta 0 → +7), contradicting the
    "most recent past" doctrine — "what did I do on monday?" recalled a week too early.
    **Fix:** bare-weekday branch uses `delta < 0 → +7` (same-day → today); the `last monday`
    branch keeps `<= 0 → +7`.
    Test: added to `__tests__/utils/date.test.ts`.

### Probes that CONFIRMED correct (no bug — coverage added)
- `utils/ai/modelFallback.ts` + `modelDisplay.ts`: ranking/fallback/`-free` naming — correct.
- `conversationCompact.ts` + `historyPrefetch.capAugmentSegments`: budget/trigger/pruning
  invariants hold → `__tests__/services/ai/compactProbe.test.ts`.
- `memoryRollupPeriods.ts` windows, `dayDigestStorage.listDayDigests` newest-first ordering,
  `goalsPrompt.calculateCurrentStreak` habit streaks, `useWeeklyInsights` window math,
  `resolveUpcomingWeekdayKey` event-orientation — all correct.
- No `space-*` / hardcoded-dark-chrome / bare `JSON.parse` violations found in prod code.

## Phase C — E2E via playwriter (DONE, with an auth-gated limitation)

Ran a real Playwright run (playwriter, headless Chrome) against the running Expo web app
(`expo start --web` on :8081):

| Check | Result |
|---|---|
| Web bundle compiles (1847 modules) after the Phase A icon codemod | ✅ no resolution errors |
| App boots to auth screens with zero fatal JS errors | ✅ (no `pageerror`/TypeError/ReferenceError in capture) |
| Login + Signup screens render; MaterialIcons subpath glyphs (👁 Show password, ← Back) paint | ✅ (snapshot + screenshot in `/tmp/rosebud-login.png`) |
| Per-family `@expo/vector-icons/MaterialIcons` imports actually render | ✅ |
| Full in-app finish/insights/reﬁne flow E2E | ⛔ auth-gated |

**Limitation (documented, not silent):** the main tabs are behind `Stack.Protected guard={auth.isAuthenticated}`,
and `EXPO_PUBLIC_DATA_PROVIDER=local` suppresses auth network by design (`resolveAuthBootstrap` returns
`signed-out` with no remembered account). Reaching the finish/intentions views requires an email-confirmed
Supabase account on the configured backend, which I did not create autonomously while the user is away.
The Phase B fixes are deterministic storage/date/hook changes covered by unit tests that ran green; no
LLM-extraction code was changed in Phase B, so the strongest E2E-mandated risk surface (structured
extraction) is untouched.

**Follow-up:** when someone can auth locally (remembered account / confirmed signup), run the Playwright
finish-path pass against the app; clear the `__DEV__` demo seed first (AGENTS.md §8) before any recall
probes.