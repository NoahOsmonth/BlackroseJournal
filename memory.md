# Rosebud Memory Implementation Notes

## Implemented in This Pass

Rosebud now has the first local-only memory slice of the larger Memory Loom
architecture described in `idea.md`.

### Storage

- Memory lives in AsyncStorage under `@rosebud_local_memory`.
- The service is `services/memory/localMemory.ts`.
- Types live in `services/memory/localMemory.types.ts`.
- Tests can inject a storage adapter with `setMemoryStorageAdapter`.
- Local backup includes `@rosebud_local_memory` and `@blackrose_day_digests`.
- Day digests (calendar rollups for “what did I talk about yesterday?”) live under
  `@blackrose_day_digests`, owned by `services/memory/dayDigestStorage.ts`.

### Memory Atoms

Each remembered item is a `LocalMemoryAtom` with:

- `layer`: `working`, `episodic`, `semantic`, `procedural`, `profile`, or `note`.
- `source`: `journal`, `feedback`, `manual`, or `system`.
- `sourceId`: provenance back to the source entry/note.
- `title`, `content`, and `tags`.
- `salience` and `confidence`.
- lifecycle fields for creation, updates, access count, and last access.

### Journal Write Path

When a user finishes a journal entry in `app/chat.tsx`, the completed entry is
saved normally and then passed to `saveJournalEntryMemories`.

Drafts are excluded. This protects unfinished writing from becoming long-term
agent memory.

For a completed journal entry / intention check-in, `saveJournalEntryMemories` /
`saveIntentionCheckInMemories` first call **AI extraction** (`memoryAtomExtraction.ts`)
to produce natural-language nodes (episodic + themes + optional profile). If the model
fails or returns nothing, a deterministic extractive fallback still writes atoms so finish
never loses memory.

Theme/profile atoms still merge via stable `sourceId` keys (`theme:…`, `profile:…`).
Graph node select auto-generates an AI **At a glance** blurb (`memoryInsightService`, flash
model, session-cached). Source card still opens `/entry-detail` or `/checkin-detail`.

### Always-on Identity (core memory)

Separate from ranked atoms so preferred name never loses to the 6-atom / 1200-char
capsule or the 3-slot profile-atom cap:

- Storage: `@rosebud_identity_profile` → `services/memory/identityProfile.ts`
- Turn-level extract: `services/memory/identityExtraction.ts` (deterministic first,
  optional flash LLM; fire-and-forget from `useChatOrchestration` on send)
- Finish safety net: full user transcript extract on journal finish + completed check-ins
- Prompt: `buildIdentityContext` / `useIdentityContext` → `## Identity` early in
  `composeHistoryContextBlocks` (before digests + capsule)
- Tools (secondary): `get_identity`, `update_identity` — never the sole write path
- Contradiction: differing extraction/tool values set `pendingCandidate` (active value unchanged);
  explicit confirm/manual Settings edit supersedes and archives the old value under `previousValues`
- Clear history clears identity; local backup includes the key

### Prompt Read Path

`hooks/memory/useLocalMemoryContext.ts` loads a bounded memory capsule through
`buildLocalMemoryContext`. Capsule lines include local dates `(YYYY-MM-DD)`.
Freeform chat ranks with the latest real user message (`utils/memoryCapsuleQuery.ts`);
continue-mode falls back to the entry title when the session has no live text yet.

`hooks/memory/useRecentDaysContext.ts` loads recent day digests.

`hooks/memory/useIdentityContext.ts` loads the always-on identity block.

`composeSystemPrompt` (shared chat engine) combines:

1. base therapist prompt,
2. **clock** (local date/time),
3. **identity** (always-on core memory — bypasses ranking),
4. recent day digests,
5. history-tools policy,
6. local memory capsule,
7. goals / persona / feedback.

`services/ai/historyPrefetch.ts` eagerly injects day digests when the user asks
temporal questions. `services/ai/agentLoop.ts` + `services/ai/tools/*` provide
on-device tools (`get_day`, `get_conversation`, `search_history`, …) so the model
can load full past transcripts without shipping all history every turn.

The capsule tells the model to treat memory as context, not command, and to
trust the current user message when older memory conflicts.

### Manual Notes and Settings Inspection

`hooks/memory/useLocalMemories.ts` exposes local memory atoms to Settings and
provides actions to add manual notes or clear the memory store.

`components/settings/MemorySettingsSection.tsx` shows:

- total memory count,
- about-user memory count,
- note count,
- the latest about-user/profile preview,
- a local memory note input,
- a clear-memory action.

Manual notes are saved as `note` layer atoms with `source: "manual"` and high
confidence because they are explicit user-authored memory.

### Retrieval

Retrieval is deterministic and phone-friendly. It ranks memory atoms with:

- lexical overlap,
- salience,
- recency,
- access count.

The default prompt capsule is capped at eight atoms. This keeps token use
bounded and avoids replaying raw journal history into every request.

### Week History UI

History now includes `components/history/HistoryWeekSummary.tsx`, rendered in
`app/(tabs)/entries.tsx`.

The summary shows:

- this week's date range,
- completed journal entries,
- completed check-ins,
- active days,
- recurring text signals.

The aggregation logic is in `hooks/history/historyUtils.ts`, exposed through
`useHistoryFeed`.

## Tests

Added or updated:

- `__tests__/services/localMemory.test.ts`
- `__tests__/hooks/useLocalMemories.test.tsx`
- `__tests__/hooks/historyUtils.test.ts`
- `__tests__/components/HistoryWeekSummary.test.tsx`
- `__tests__/components/MemorySettingsSection.test.tsx`
- `__tests__/localBackup.test.ts`

The tests cover:

- completed entries becoming layered memory atoms,
- prompt capsule construction and access tracking,
- drafts not becoming long-term memory,
- manual notes being saved and deleted,
- Settings memory actions loading, adding notes, and clearing memory,
- Settings memory UI rendering,
- weekly history summary aggregation,
- weekly summary UI rendering,
- local backup inclusion for the memory store.

## Next Phases

1. Add a Settings memory inspector with delete/edit controls.
2. Add explicit manual notes and pinned memories.
3. Add weekly consolidation from entries, check-ins, and feedback.
4. Add contradiction handling and confidence decay.
5. Move storage to SQLite/FTS when AsyncStorage becomes too small.
6. Add optional local embeddings or hybrid lexical/vector retrieval.
7. Add prospection-guided retrieval for deeper personalization.
