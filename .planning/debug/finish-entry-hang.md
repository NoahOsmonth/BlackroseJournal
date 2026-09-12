# Debug session — 2026-09-12 — Finish entry takes forever

**Status:** RESOLVED (`--diagnose` not used; fix applied and verified in browser)
**Symptom:** Tapping **Finish entry** hangs (user waited > 1 min, killed the tab). Reopening the
app shows the entry already saved in History.

## Root cause

A render loop on `/entry-reflection` fired `generateEntryReflection` continuously, flooding the
browser's per-origin connection pool. Every later AI call — including the entry title that Finish
awaits before saving — queued behind that backlog, so Finish "took forever" on every entry after
the first one in that tab.

Loop mechanics (all three were needed):

1. `services/journal/finishBackgroundStore.ts` keeps a **settled** run in memory forever, so
   `useFinishBackgroundStatus().isDone` stays `true`.
2. `app/entry-reflection.tsx` ran `useEffect(() => { if (isDone) void refresh(); }, [isDone, refresh])`.
3. `hooks/journal/useEntryReflection.ts` returned `refresh: () => load(true)` — a **new function
   identity every render**, so the effect re-ran after every render. Each iteration awaited
   `getEntry` then called `generateEntryReflection`, and `setEntry`/`setData` re-rendered, which
   fired the effect again.

## Evidence (Playwriter, live OmniRoute + user's signed-in web app)

Before fix, my own tab, `/entry-reflection?entryId=entry_...` (fetched via injected `fetch` counter):

```
total: 28214 requests to http://100.107.7.52:20128/v1/chat/completions
pending: 1358
last request fired at "now" (storm still running)
<body> snapshot: CDP DOM.enable timed out after 30s — tab unresponsive
POST bodies captured: "You are a journaling reflection assistant." (x12 in 1.5s)
```

Entry title on hand-picked run measured at 1.43 s when no backlog existed — the model was never
the problem.

After the fix, same flow, same machine:

```
Finish click -> /entry-reflection:  1693 ms  (repeat finish, previously the hanging case)
reflection screen, requests over 45 s: 8, 8, 8, 8, 8, 8, 8, 8, 8   (6 background steps + 1 hindsight retain + 1 reflection refresh)
re-run after refactor: 2022 ms click->nav; requests stable at 12 for 30 s
```

## Fix

| File | Change |
|---|---|
| `hooks/journal/useEntryReflection.ts` | `refresh` via `useCallback`; module-level in-flight map keyed `<entryId>:<force>` collapses overlapping loads into one AI call |
| `hooks/journal/useRefreshOnFinishRun.ts` | new shared guard: one refresh per settled run (runId + entryId match), idempotent even with unstable `refresh` |
| `app/entry-reflection.tsx` | uses `useRefreshOnFinishRun(refresh, entryId)` |
| `app/saved-insights.tsx` | same hook replaces the identical sticky-`isDone` effect |
| `app/chat.tsx` + `utils/async.ts` | the blocking title call is now capped at 8 s so a stalled provider falls back to the local title instead of holding Finish open |

## Regression tests (sabotage-verified)

- `__tests__/utils/async.test.ts` — resolve / labelled timeout / original rejection.
- `__tests__/hooks/useEntryReflection.test.tsx` — `refresh` identity stable across renders;
  overlapping refreshes collapse to one generation.
- `__tests__/hooks/useRefreshOnFinishRun.test.ts` — once per run, again on a new run, ignored for
  another entry, silent when nothing settled.
- `__tests__/screens/EntryReflection.test.tsx` — refresh once across re-renders; cross-entry run
  ignored.

Sabotage evidence: dropping the runId guard → `Expected 1 / Received 3` in both the hook and the
screen suite; restoring the guard → 12/12 green. Dropping in-flight dedupe → 3 generations
instead of 2. Unstable `refresh` → `Expected [Function refresh] / Received serializes to the same
string`.

## Follow-ups (not done here)

- The reflection hook still has no ceiling on a hung `generateEntryReflection` (screen shows the
  skeleton indefinitely). Consider the same bounded-wait treatment if it ever bites.
- Pre-existing unrelated red suites: `__tests__/docs/aiControlPlaneOperations.test.ts`,
  `__tests__/metro-phosphor-resolve.test.ts` (fail on baseline too).
