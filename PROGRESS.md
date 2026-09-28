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
reproducible — the R1+R2 delta, stable across runs. Last full gate: **273
suites passed / 9 skipped (282 discovered), 1490 tests green**, tsc / lint /
`check:design` clean.

## Dated log

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
7. **The live provider gate is unmet, and blocked on an endpoint rather than on
   code.** The recall probe and `RUN_INTEGRATION_TESTS=1` need a reachable chat
   provider; the gateway the owner deleted refuses TCP. The provider-profile
   write path therefore has unit coverage but no live-network confirmation —
   point the app at a reachable endpoint and re-run (AGENTS.md workflow step 7).
8. **`customModels` v1 → v2 migration is unit-tested only.** It has never run
   against a real device's stored v1 payload.
9. **Live integration tests still default to gateway-specific model ids**
   (`tencent/hy3:free`, `nvidia/nemotron-3-ultra-550b-a55b`) when `.env` omits a
   model — harmless while skipped, but the last baked-in model strings outside
   dated history.
10. **`example-design/concepts/UI_MAP.md` still lists an Account row** (email,
    sign in/up/out) that has not existed since auth was removed — stale in the
    same way the AI Model row was; left alone to keep that diff scoped.
11. **A provider with no model cannot be renamed persistently.**
    `saveSettings` requires a selected model and `getActiveCustomModelConfig`
    throws on "enabled but no model selected", so relaxing the guard would create
    a state that breaks chat. The name is editable at add time and persists once
    a model is fetched.

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
