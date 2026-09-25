# PROGRESS — Work Log

Record of what has been built, verified, and left open. One entry per effort,
newest last inside each era. **The full unreduced text of every entry through
2026-09-21 lives in this file's git history** (`git log --oneline -- PROGRESS.md`,
then `git show <commit>:PROGRESS.md`); this file was condensed to its durable
content on 2026-09-24.

---

## Current state (as of 2026-09-21)

**Blackrose** — a local-only React Native / Expo journal with an AI companion
that remembers on-device. No auth server, no cloud memory, no managed gateway:
every write lands in AsyncStorage under an account-scoped key, and chat talks
directly to an OpenAI-compatible provider with a user-supplied key.

| Area | State | Since | Where |
|---|---|---|---|
| Agent chat engine | Pi-class loop: tool shortlist → parallel pure reads → one mutating call per turn, idempotency, strict finality (status-only replies continue) | 2026-09-10 | `services/ai/agentLoop.ts`, `executeTool.ts`, `agenticGate.ts`; spec in `docs/compose/spec/` |
| Transport | OpenRouter removed; device-direct BYOK to the local OmniRoute gateway; default model `merge/deepseek/deepseek-v4-flash-0731` | 2026-09-10/18 | `services/ai/aiTransport.ts`, `directConfig.ts` |
| Local-only build | Hindsight, Supabase, managed AI gateway, and the auth surface deleted; device-local account id instead | 2026-09-18 | `services/auth/localAccount.ts`; contract in `notes/local-only-storage.md` |
| Offline memory (Era 3) | File-semantic store with `_tmp` staging on finish; recall = intent gate → thread shortlist → manifest headers → top-K bodies, budgets 12k/file / 30k total / top-5 / 30s cache | 2026-09-12 | `services/memory/memoryFiles.ts`, `memoryRetrieval.ts`; plan in `.planning/offline-memory/` |
| Consolidation | Idle Dream trigger (single-flight, never during a streaming turn) + fading + supersession with audit fields ("when unsure, keep separate") | 2026-09-16 | `memoryDreamTrigger.ts`, `memoryFade.ts`, `memorySupersession.ts` |
| Atom store | Sharded 8-way header+shards store, cap 400 (a storage bound in disguise) → 4000; corrupt shard is quarantined, not fatal | 2026-09-16 | `services/memory/localMemory.ts` (`schemaVersion: 3`) |
| Identity | Always-on core memory (`@rosebud_identity_profile`), contradiction → `pendingCandidate`, never auto-applied | 2026-09 | `services/memory/identityProfile.ts`, `identityExtraction.ts` |
| Explore write path | `/explore` ledger port; a note fans out to four stores (journal entry, atom, `'note'` memory file staged `_tmp`, day digest); recall proven live and verbatim | 2026-09-20/21 | `MemoryHubScreen.tsx`, `saveExploreNote` |
| Today/insights UX | Insight "More options" modal replaced by an in-card Action Dock (variant C), measured 44px targets | 2026-09-19 | `components/today/InsightActionDock.tsx` |
| Settings UX | Hairline list replaced by tonal bands (variant E), `band-*` tokens mixed 72% from the palette | 2026-09-19 | `SettingsAccordionSection.tsx`, `tailwind.config.js` |
| Radial menu / dock | Long-press write menu rebuilt as a real overlay (fixed geometry, scrim, touch-release bug); dock height constant corrected 96 → 64 | 2026-09-19 | `radial-menu.tsx`, `components/journal/BottomNav.tsx` |
| Threads | Memory-graph canvas gains a chrome dissolve so the stats strip reads as HUD on the art, not a grey slab | 2026-09-19 | `assets/memory-graph/engine.html`, `MemoryGraphStats` |
| QA program | 107 documented cases (97 active), 3 runs executed, DEF-001–014 all fixed; last dashboard 78 Pass / 0 Fail / 9 Blocked / 19 Untested | 2026-09-17 | `QA-Plan.md`, `docs/qa/` |
| Baseline hardening | Android bundle −59.8% (icon barrel), 10 tested bug fixes (week keys, DST streaks, UTC dates, …), sse/streak/color-derivation coverage | 2026-09-02/03 | `scripts/analyze-bundle.mjs`, `__tests__/` |

Recall metrics on the frozen R0 ledger (`probes/shared/recallLedger.ts`):
hit-rate 16.7% → **83.3%**, precision 0.167 → **0.433**, thread selection
reproducible — the R1+R2 delta, stable across runs. Last full gate: **270
suites / 1430 tests green** (25 skipped), tsc / lint / `check:design` clean.

## Dated log

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

1. **Deleting a note leaves it searchable.** `useLocalMemories.removeAtom` /
   `clearAll` only touch the atom shards, never `deleteMemoryFilesBySourceSessions`
   — the `'note'` memory file and its journal entry survive deletion. The more
   serious of the two T16 findings.
2. **`memory_search` can miss `_tmp` notes once any formal thread exists** —
   thread-resolved recall scans only that thread's headers; a staged note is
   reachable only through the 5-item recency fallback. Fix belongs in retrieval
   gating, not the write path.
3. **R3 is gated, not forgotten.** Prerequisite: a real-restatement ledger
   (measuring how often a journal actually restates itself; the R0 ledger
   reports `superseded: 0` by design). Building temporal reasoning on
   entity resolution of unknown value is the exact move the R-series
   repeatedly declined.
4. **Identity-store split** — `get_identity` vs the offline user file: an
   unmeasured design question deliberately left open.
5. **Insight dock polish** — no Escape / Android back-close parity; two labels
   wrap and stagger the icon row (matches the approved prototype; fixing
   changes copy).
6. **Doc drift noted in passing** — the explore plan's `noteFiles` stat
   (`plan:61`) is unimplemented by agreement, and `design.md:227` still
   describes the pre-fix drift mechanism.

## Operational doctrine worth re-reading (distilled from the log)

- **Measurement before design.** Every variant port, cap change, and "is it a
  bug?" call above was settled by measuring the running app or a probe, not by
  reading code. Twice, measurement reclassified a "bug" as correct behavior.
- **A harness that cannot fail proves nothing.** Audit scripts carry a
  `selfTest()` (green case + deliberate sabotages); two false-defect reports and
  one false-pass were caught this way.
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
