# Rosebud Memory Implementation Notes

## Implemented in This Pass

Rosebud now has the first local-only memory slice of the larger Memory Loom
architecture described in `idea.md`.

### Storage

- Memory lives in AsyncStorage under `@rosebud_local_memory`.
- The service is `services/memory/localMemory.ts`.
- Types live in `services/memory/localMemory.types.ts`.
- Tests can inject a storage adapter with `setMemoryStorageAdapter`.
- Local backup now includes `@rosebud_local_memory`.

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

For a completed journal entry, the current implementation creates:

- one episodic atom from the user's journal text,
- one profile atom with a conservative "recent pattern",
- up to four semantic theme atoms from generated entry analysis topics.

### Prompt Read Path

`hooks/memory/useLocalMemoryContext.ts` loads a bounded memory capsule through
`buildLocalMemoryContext`.

`app/chat.tsx` combines:

1. the base therapist system prompt,
2. the local memory capsule,
3. saved AI feedback guidance.

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
