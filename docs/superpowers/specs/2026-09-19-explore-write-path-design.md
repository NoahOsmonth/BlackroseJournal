# Explore + Write Path — Design

**Date:** 2026-09-19
**Status:** Draft for review
**Spec:** 1 of 3 (Explore + write path → Extractor content model → Dream agent)
**Architecture companion:** `2026-09-19-explore-memory-architecture.html` (same directory — open it first; the diagrams carry the flow better than prose)

---

## 1. Purpose

Replace the Explore/Threads screen with the ledger design (prototype variant A, "Index") and make writing on it produce **real, recallable memory** — not a second-class note that the AI's search tool cannot see.

Two things are wrong today, and they are different problems:

1. **The screen.** Four identical bordered rectangles in a column — chips, segment, search, thirty atom cards — so every element had equal weight and nothing led. At its foot sits a fake AI panel whose "Blackrose noticed" block makes zero LLM calls; it is a string template wrapping the user's own words in canned therapy-speak.
2. **The write path.** A note saved there reaches only the atom store. `memory_search` — which AGENTS.md rule 9 calls the primary and only long-term recall path — reads only the memory-file store. The two never intersect.

The screen is what the user asked for. The write path is what makes it honest.

### Intent, recorded

- The Threads tab is for **free-form journaling with no AI in the loop**. Writing there must not trigger model processing.
- A note is **not** a lesser artifact. It becomes a real journal entry and real recallable memory.
- The AI must be able to **find** a note by tool call, not merely happen to have it in context.
- User-written words are **never** paraphrased into a claim about the writer.

### Success criteria

1. Writing on Explore and pressing Keep creates: a memory atom, a memory file, a completed journal entry, and a day digest — verified by test, all four.
2. `memory_search("<topic>")` in chat returns the note's text **verbatim** after Dream promotes it. Verified live, not only in Jest (AGENTS.md rule 7).
3. **No model call fires at write time.** Verified by asserting the write path imports no LLM helper.
4. The note appears in Archive/History as a real entry, labelled as written on Threads.
5. The fake panel and its generator are gone, including the test that pins the "Rosebud" string.
6. Light and dark QA'd against `example-design/blackrose/explore-variants/variant-a-index.html`.
7. `npm run check:design`, `npx tsc --noEmit`, `npm run lint`, `npm test` all green.

---

## 2. What exists today (verified)

Every claim below was checked against source. Line numbers are from the current tree.

| Fact | Where |
|---|---|
| A note writes one atom: `{layer:'note', source:'manual', salience:0.9, confidence:1}` | `localMemory.ts:570` `saveManualMemoryNote` |
| Atoms live in `@rosebud_local_memory_shard:0..7` + a header index | `localMemory.ts:35-39` |
| `memory_search` reads **only** `@blackrose_memory_manifest` + `@blackrose_memory_file:<id>` | `memoryRetrieval.ts` imports `memoryFiles` + `memoryFade` — never `localMemory` |
| So the note **is** passively visible: `retrieveLocalMemories` → `rankAtom` applies **no layer/source filter**, so it lands in the capsule | `localMemory.ts:905-967`, capsule capped at 6 atoms / 1200 chars |
| And reachable via `search_history` (truncated to 180 chars, max 8 hits) | `historyTools.ts:194` |
| But **not** findable by `memory_search` / `memory_list` / `memory_get` / `memory_overview` | verified: no code path between the stores |
| `stageTmpMemory` cannot create a user note — its type union is `'feedback' \| 'project'` | `memoryFiles.ts:43-57`, `:254` |
| `normalizeProjectId` accepts **any** non-empty string, so a writer may target a real thread | `memoryFiles.ts:192-196` |
| **`type:'user'` files are the only ones protected from supersession** | `memorySupersession.ts:125` (`header.type !== 'user'`) |
| Journal entries have **no provenance field** | `journalStorage.types.ts:18-29` |
| `upsertJournalDayDigest` requires `status === 'completed'` and reads `analysis.topics` / `analysis.insight`, falling back to the raw user text | `dayDigestStorage.ts:218-226` |
| `extractTags` = `tokenize` (length > 3, stopwords removed) → top 8 by frequency | `localMemory.ts:115-120` + `keywordRanking.ts:39-44` |
| Dream's LLM call proposes a **plan only** — bodies are never rewritten | `memoryDream.ts:94-117` |

### The two-store problem, stated plainly

```
Explore composer ──→ @rosebud_local_memory_shard:*      ← capsule reads this (works today)
                    ╳  no path
memory_search ─────→ @blackrose_memory_manifest         ← can't see the note
```

This is why the gap survived: recall *feels* like it works, because the capsule often happens to contain the note. Only the dedicated search tool is blind.

---

## 3. Architecture — the write path

### One function owns the fan-out

`services/memory/exploreNote.ts` exports:

```ts
export interface ExploreNoteInput {
    text: string;
    /** Injected for tests; defaults to Date.now(). */
    now?: number;
}

export interface ExploreNoteResult {
    entry: JournalEntry;
    atom: LocalMemoryAtom;
    file: MemoryFileRecord;
    /** Stores that failed after the entry was durably written. */
    failures: ExploreNoteFailure[];
    themes: string[];
}

export async function saveExploreNote(input: ExploreNoteInput): Promise<ExploreNoteResult>;
```

Mirrors how `journalFinishSideEffects.ts` owns the chat-finish path: one entry point, so "did every store get written?" is a testable question rather than four scattered calls.

### Write order — entry first, and why

| # | Store | Why this position |
|---|---|---|
| 1 | **Journal entry** (`@journal_entries`) | The user's actual words. Durable and visible in Archive. Everything else references its id, so it must exist first. If a later store fails, the writing is already safe. |
| 2 | **Memory atom** (`@rosebud_local_memory_shard:*`) | Feeds the always-on capsule. `sourceId` / `rootSourceId` = the entry id. |
| 3 | **Memory file** (`@blackrose_memory_manifest` + body) | The bridge. Staged to `_tmp` with a thread hint. |
| 4 | **Day digest** (`@blackrose_day_digests`) | Built from the entry's own text. |

**Why entry-first matters:** it converts a partial failure from "the user's writing is lost" into "the derived memory is incomplete, and the words are still in Archive." That is the only acceptable direction to fail.

### No model call

The write path is deterministic. It must not import `fetchDirectJsonCompletion`, `completeChat`, `streamChat`, or anything under `services/ai/` that calls a provider. Enforced by test (§9).

Consequently the atom and file carry **no LLM analysis**: `title` is derived locally (first sentence, word-boundary clipped), `tags` from `extractTags`, and the day digest carries the user's text rather than a model summary. This is the point — the page promised no AI, so nothing is invented at that moment.

### Deferred to Dream

Identity extraction (`identityExtraction.ts`) and session digests (`buildAndSaveSessionDigest`) are **not** called. Those are the two finish-path side effects that invoke a model. They run later, in Dream (spec 3), when the app is idle.

---

## 4. Interface changes

### 4.1 New memory file type: `'note'`

```ts
export type MemoryFileType = 'user' | 'feedback' | 'project' | 'note';
```

**Why not reuse `'user'`.** `'user'` files feed the recall `user` route — the one that fires on *"my name / call me / about me / my wife"* (`memoryRetrieval.ts:50`). Routing notes there would dump the five newest notes into identity queries and crowd out the actual identity file. `'note'` is semantically honest and keeps that route clean.

**And add `'note'` to the supersession skip list.** This is the property that makes user-written words undeletable — today only `type === 'user'` has it (`memorySupersession.ts:124-126`). Without this change a note could be auto-deprecated as "restated by a newer memory in the same thread."

**The trap to avoid.** `memoryListTool` does **not** derive its accepted kinds from `MemoryFileType` — it hardcodes an allowlist (`memoryFileTools.ts:75`):

```ts
const kind: 'all' | MemoryFileType = kindRaw === 'user' || kindRaw === 'feedback' || kindRaw === 'project'
    ? kindRaw
    : 'all';
```

Adding `'note'` to the type alone would make `memory_list({"kind":"note"})` **silently return all kinds** — no error, wrong answer. This coercion must be replaced with a check derived from the type (or a shared constant) so it cannot drift again. Same for the tool schema enum at `definitions.ts:130` and the schema-pin test at `__tests__/services/ai/toolSchemaPin.test.ts:146`, which changes deliberately.

### 4.2 New writer: `stageUserNoteMemory`

```ts
export interface StageUserNoteInput {
    text: string;
    /** Top tag from extractTags — becomes the thread hint. Absent when nothing was recognised. */
    threadHint?: string;
    /** Journal entry id; used for staging idempotency. */
    sourceEntryId: string;
    capturedAt?: string;
}

export async function stageUserNoteMemory(input: StageUserNoteInput): Promise<MemoryFileRecord>;
```

Emits `type: 'note'`, `scope: 'project'`, `projectId: TMP_PROJECT_ID`, and a description carrying `Thread hint <slug>.` — the exact convention `clusterTmpFiles` already groups on (`memoryDream.ts:43-46`), so Dream files a note beside the journal memories of the same subject rather than in a separate pile.

- `sourceSessionKey = sourceEntryId`, so `hasStagedSession` (`memoryFiles.ts:426`) gives idempotency for free.
- When `threadHint` is absent (short note, all stopwords), no hint is written; Dream's fallback groups it as `solo-<slug>`.
- Throws on empty text, matching `stageTmpMemory`.

**Not** a new `projectId` per note — that would proliferate single-file threads and defeat `scoreThread`.

### 4.3 Journal entry provenance

`JournalEntry` gains:

```ts
/** Where this entry was written. Absent on older entries → treated as 'chat'. */
origin?: 'chat' | 'threads';
```

Read as `entry.origin ?? 'chat'` everywhere, so existing entries are unaffected and Archive can label "Written on Threads" without pretending it came from chat.

**On schemaVersion (AGENTS.md rule 4).** The journal store has **no** schemaVersion envelope today (verified: no `schemaVersion` in `journalStorage.ts`). Adding an *optional* field that readers default is backward compatible in both directions — old data stays readable, old readers ignore the field. Rule 4's concern is unreadable old data, which does not arise. If this change ever touches a required field or reinterprets an existing one, the envelope becomes mandatory and must be added first.

### 4.4 Atom provenance — a coherence win

The atom is written with real provenance:

```ts
sourceId: entry.id,
rootSourceId: entry.id,
rootSourceKind: 'journal_entry',
```

Because the note **is** now a journal entry, `memoryAtomRoute` (`memoryDisplay.ts:104`) resolves `journal_entry` → `/entry-detail`, so tapping the memory card opens the entry containing the note. Notes stop being dead ends. This also fixes the id-collision defect for free: `entry_<ts>_<random>` cannot collide, unlike `note:${Date.now()}`.

### 4.5 Theme source — no new vocabulary

The composer's "Filed under" preview and the thread hint both use the **existing** `extractTags`. No new theme vocabulary is introduced; a competing word list would mean two theme systems, and tag *quality* is the extractor's problem (spec 2).

One fix required: `topMemoryThemes` filters notes out (`memoryDisplay.ts:61` — `.filter((atom) => atom.layer !== 'note')`), so a user who only writes on Explore would see no themes at all. Stop excluding `layer === 'note'`.

---

## 5. UI — the ledger port

Port `example-design/blackrose/explore-variants/variant-a-index.html` into React Native + NativeWind.

**Structure, in order:** page head (Memory / "What Blackrose holds for you") → hairline rule → **composer** → portrait (About you + drifting theme strip) → filter line → search rule → "Written" list head → dated entry rows.

**Components:**

| Component | Role | Notes |
|---|---|---|
| `ExploreComposer` | The primary action. Date column, input, "Filed under" preview, Keep. | Replaces `MemoryNotesPanel` |
| `MemoryLedgerRow` | One memory: serif date column, title (claim), body (evidence), layer dot, confidence, recurrence, provenance | Replaces `MemoryAtomCard` |
| `ThemeDriftStrip` | Horizontally scrolling, slowly drifting theme words | New; see below |
| `MemoryPortrait` | Keep, with the note-inclusive theme source | Edit |
| `MemoryEmpty`, `MemoryHubSkeleton` | Rebuild to mirror the new layout | Edit |

**Composer behaviour.** Live "Filed under" preview as you type, from the same local matcher the write path uses. When it recognises nothing it **says so** ("Nothing recognised — it will be kept as written") rather than inventing an observation, and never blocks keeping the note. No Refresh (nothing to recompute). No "Keep this as a note" (this *is* the note).

**Date column.** Month over day, serif, in the margin. The month is dropped on a repeat of a day already shown above it — how a printed ledger handles continuation. Today's date is inked with a short rule. These are **write** dates, never event dates (clock doctrine), which is why the list head says "Written".

**Motion tokens** live in one place, matching the prototype: `--dur-fast` 180ms, `--dur-mid` 320ms, `--dur-slow` 520ms, and the shared easing curves. The list animates on arrival only, never per keystroke: a search re-filter fades the set as one block rather than staggering items.

### The drifting theme strip

The prototype drove `scrollLeft` because a CSS transform and native scroll cannot both own the offset. RN maps faithfully:

- `Animated.ScrollView` (horizontal) whose `scrollTo({ x, animated: false })` is driven from a Reanimated frame callback.
- Pause on `onScrollBeginDrag`; resync from `contentOffset.x` on drag end, so native momentum and flick are preserved.
- Seamless wrap via periodic content: N identical runs, offset normalised modulo one run's width.
- Gated on `useReducedMotion()` — the strip loses self-propulsion but stays fully scrollable, exactly as the prototype does.

Fallback if JS/native jitter shows up on device: a pan-driven `translateX` on a doubled row. Jest's reanimated mock cannot observe motion, so this needs a real browser check (§9).

**One a11y rule learned from the prototype:** only the first run may contain focusable elements. Duplicated runs exist to make the offset periodic; putting buttons in them creates a focus trap (tabbing walks the same words repeatedly) and puts focusable content inside `aria-hidden`. Repeats are inert, and the strip itself is focusable so keyboard users can scroll it.

### Deletions

- `components/memory/MemoryNotesPanel.tsx`
- `generateMemoryNoteSuggestion`, `saveGeneratedMemoryNote` (`localMemory.ts`), `topAtoms` (its only caller)
- `addGeneratedNote`, `refreshGeneratedNote`, `generatedNote` from `useLocalMemories`
- The assertion on `"Rosebud notices you often return to themes of"` (`__tests__/services/localMemory.test.ts:158`)
- `MemoryNotesPanel` from the barrel `components/memory/index.ts`

**Note on `topAtoms`:** deleting the panel removes the only place notes were excluded from ranking. No ranking change is needed — the exclusion disappears with its caller.

**Guard tests to keep meaningful:** `dark-mode-contrast.test.ts` asserts `"Open graph"` and hairline classes in `MemoryHubScreen.tsx`. The port keeps a graph affordance so that guard still asserts something real, rather than being deleted to make a rewrite pass.

---

## 6. The carve-out: live data loss

**Not part of this spec's feature work, but to be fixed as a small standalone change alongside it.**

In `promoteTmpRecord` (`memoryFiles.ts:526-527`) the manifest is written **before** the body:

```js
await saveManifest(manifest);                       // new header live; _tmp already deprecated
await storageAdapter.setItem(bodyKey(newId), body); // ← kill the app here
```

The same ordering exists in `stageTmpMemory` (`:285-286`). If the process dies between the two writes, the result is a manifest header with **no bytes**, its `_tmp` source already marked deprecated, and no reconciliation pass anywhere that notices. `getMemoryRecordsByIds` silently skips a missing body (`:380`), so the memory is unreachable from both the backlog and recall — **permanently**.

**Fix:** make the write order body-first, manifest-second. An orphan body key is harmless (unreferenced, reclaimable); an orphan manifest header is data loss. Add a reconciliation pass that reports manifest headers whose body is missing, so any existing orphans are surfaced rather than silent.

This is independent of the Dream agent (spec 3) and should not wait for it.

---

## 7. Failure modes

| Failure | Behaviour |
|---|---|
| Empty / whitespace-only text | Rejected before any write. Service-level validation (today only the UI guards). |
| Entry write fails | Nothing else is attempted; the error surfaces. The note is not lost — it is still in the composer. |
| Entry succeeds, a later store fails | Entry is durable; `failures[]` reports which stores failed. UI keeps the note visible and offers retry. Never a silent partial write. |
| Same text kept twice | Two entries (each with a fresh id). The atom ids differ because they derive from the entry id. No collision, no accidental merge. |
| Idempotency on retry | `sourceSessionKey = entry.id` means re-staging the same entry is a no-op via `hasStagedSession`. |
| Dream never runs | The note is still recallable by recency fallback (`memoryRetrieval.ts:171`) and via `memory_list`. Topic recall is what waits. |
| Provider down | Irrelevant at write time — no model is called. |

---

## 8. Testing

**Unit (deterministic, no network):**

1. `saveExploreNote` writes all four stores — assert each by reading it back.
2. No model call: assert the module graph of the write path imports no provider helper.
3. Empty text rejected; nothing written.
4. Partial failure: force the file write to throw → entry still present, `failures` reports it, no silent loss.
5. Atom provenance: `rootSourceKind === 'journal_entry'`, `rootSourceId === entry.id`, and `memoryAtomRoute` resolves to `/entry-detail`.
6. `stageUserNoteMemory` writes `type:'note'` with `Thread hint <slug>.` in the description when a hint exists, and omits it otherwise.
7. `'note'` files are skipped by supersession (the undeletable-words property).
8. **`memory_list` kind coercion** — `{"kind":"note"}` filters to notes; a bogus kind falls back to `all`. This is the regression test for the allowlist trap.
9. `topMemoryThemes` includes note-derived themes.
10. Keep-same-text-twice produces two distinct entries and two distinct atoms.

**Live / E2E (AGENTS.md rules 7–9 — required, not optional):**

11. Playwright against the running app with **cleared demo data**: write a note on Explore, then in chat call `memory_search("<topic>")` and confirm the note comes back **verbatim**. Paste the real reply, not a summary.
12. Offline boot: every host but the chat provider blocked; `/today` renders with content, 0 page errors.
13. Light + dark QA against the prototype HTML.

**Sabotage discipline** (per the changelog): for each behaviour fix, break it deliberately → confirm red → restore → confirm green. Never mock the unit under test.

---

## 9. Out of scope

| Item | Where it goes |
|---|---|
| Extractor content model — leaked machine prose, third person, title == content, post-model validation | **Spec 2.** Affects Explore, the graph, and Today; needs live-model E2E. |
| Shared theme vocabulary, `deriveThemes` ↔ `extractTags` reconciliation | **Spec 2** (see §4.5 — this spec deliberately adds no vocabulary). |
| Dream agent: resumable checkpointing, tool calls, 120k budget, read-only viewer, opportunistic background runs | **Spec 3.** |
| The orphan-hazard fix | **Carve-out, §6** — do it now, not in spec 3. |

---

## 10. Decisions recorded

| Decision | Choice | Rationale |
|---|---|---|
| What "the AI can see it" means | Dual-write to atoms **and** memory files | Makes rule 9's "only recall path" true rather than aspirational |
| What a note creates | Also a real journal entry | Writing on Explore must count; otherwise the app looks empty on days the user actually wrote |
| Write-time processing | Deterministic; LLM work deferred to Dream | The page promises no AI in the loop — it must keep that promise literally |
| Recall bridge | `type:'note'` + theme thread-hint, staged to `_tmp` | Notes become the *same kind of thing* as extracted memory, and inherit supersession protection |
| `'note'` vs reusing `'user'` | New type `'note'` | Keeps the identity `user` route clean; costs a deliberate tool-schema change |
| Theme source | Existing `extractTags`, no new vocabulary | One mechanism; tag quality is spec 2's problem |
| Spec order | Explore → Extractor → Dream | Dream needs a sound store; notes feed it |
| Retired concept image | `black-rose-memory-hub.png` deleted; `UI_MAP.md` updated | It depicted the design being removed; a dangling "open the concept first" rule would have ported the panel back |
