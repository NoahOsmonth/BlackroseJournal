# Explore + Write Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Explore screen with the ledger design and make writing there produce real, recallable memory — a journal entry, a memory atom, a memory file, and a day digest — so `memory_search` can find a note by tool call.

**Architecture:** One orchestration function (`saveExploreNote`) owns the four-store fan-out, mirroring how `journalFinishSideEffects.ts` owns the chat-finish path. The write path is deterministic and calls no model. Notes become a first-class memory-file type (`'note'`) staged to `_tmp` with a `Thread hint <slug>.` description so Dream files them beside the journal memories of the same subject. The UI is ported from the locked prototype `example-design/blackrose/explore-variants/variant-a-index.html`.

**Tech Stack:** React Native + Expo, NativeWind v4, Reanimated 4.1.1, AsyncStorage (account-scoped), Jest + `@testing-library/react-native`, Playwright for the live/offline gates.

**Spec:** `docs/superpowers/specs/2026-09-19-explore-write-path-design.md` (read it first — the plan argues from it). Visual companion: `docs/superpowers/specs/2026-09-19-explore-memory-architecture.html`.

## Global Constraints

- **Every color is a token, both schemes.** Every `<Text>` needs a `dark:` variant. No bare hex in `app/` or `components/` — read `constants/blackrose.ts` / `constants/theme.ts`. Undefined NativeWind tokens are silently dropped.
- **Never `space-y-*` / `space-x-*`.** Use `gap-*` on the flex container. Guarded by `__tests__/no-space-utilities.test.ts`.
- **Design/UI files ≤ 500 lines** (`app/**`, `components/**`, `global.css`, `constants/theme.ts`). Enforced by `npm run check:design`; warns at 450.
- **No `any`** — use `unknown` and narrow.
- **UI → hooks → services.** Components may import *types and pure functions* from services; all I/O goes through a hook. Services never import from `components/` or `hooks/`.
- **One module owns each storage key.** All mutations of a key go through that module's single serialized queue. Every `JSON.parse` of a storage payload sits in `try/catch` with a safe default.
- **Local-only.** No network except the chat provider. The write path added here calls **no model at all**.
- **No new theme vocabulary.** Use the existing `extractTags` (length > 3, stopwords removed → top 8 by frequency).
- **Nothing in "What NOT to touch"** — no lockfiles, `node_modules/`, `dist/`, `.expo/`, `example-design/**` writes (read freely), or `@generated` files.
- **Test files ≤ 300 lines.** `<Subject>.test.ts(x)` matching the source file. >10 tests in a folder → split into `__tests__/{components,hooks,services,screens}/`.
- **Sabotage discipline** (AGENTS.md changelog): for each behaviour fix, break it deliberately → confirm red → restore → confirm green. Never mock the unit under test.

## Review Focus

Inputs and failure modes the spec implies but no single task's happy-path test covers. Each line gets its test in the owning task.

1. **A note longer than the atom's 600-char trim.** A reasonable person expects the text recall returns to be the text they typed. If the entry keeps 2000 chars while the atom keeps 600, `memory_search` returns a different (shorter) string than the composer showed. One clipped value must feed every store. → Task 8.
2. **A note whose text is entirely stopwords or sub-4-char tokens.** `extractTags` returns `[]`, so `threadHint` is `undefined`. The file must still stage with a non-empty description and Dream must still file it. → Tasks 2, 8.
3. **Text that is only whitespace/punctuation.** Must be rejected *before* any write, leaving zero partial artifacts. → Task 8.
4. **A note written on a day that already has a journal entry.** The day digest must merge, not clobber, the entry's summary. → Task 8.
5. **`memory_list({"kind":"note"})`.** The enum/allowlist must not drift back to silently returning *all* kinds. → Task 5.
6. **The app killed between the two writes of a promotion.** Must leave an orphan body (reclaimable), never a header with no bytes. → Task 3.

---

## File Structure

**Create**

| Path | Responsibility |
|---|---|
| `services/memory/exploreNote.ts` | `saveExploreNote` — the four-store fan-out; `deriveNoteTitle` |
| `components/memory/ExploreComposer.tsx` | The primary writing surface: date column, input, "Filed under" preview, Keep |
| `components/memory/MemoryLedgerRow.tsx` | One memory as a ledger row (replaces `MemoryAtomCard`) |
| `components/memory/ThemeDriftStrip.tsx` | The slowly drifting, horizontally scrollable theme words |
| `__tests__/services/exploreNote.test.ts` | Fan-out, validation, partial failure, provenance |
| `__tests__/services/memory/memoryNoteFiles.test.ts` | `'note'` type end-to-end: round-trip, hint, supersession skip, kind coercion, write ordering |
| `__tests__/components/MemoryLedgerRow.test.tsx` | Row rendering + actions |
| `__tests__/components/ExploreComposer.test.tsx` | Composer states |
| `__tests__/components/ThemeDriftStrip.test.tsx` | Focusability contract |
| `__tests__/services/exploreNoteImports.test.ts` | The "no model call" module-graph guard |

**Modify**

| Path | Change |
|---|---|
| `services/memory/memoryFiles.ts` | `'note'` type + `MEMORY_FILE_TYPES`; `isHeader` derived; `stageUserNoteMemory`; body-first ordering; `findOrphanManifestHeaders`; `noteFiles` stat |
| `services/memory/keywordRanking.ts` | `extractTags` moves here (pure, shared) |
| `services/memory/localMemory.ts` | Drop `generateMemoryNoteSuggestion`, `saveGeneratedMemoryNote`, `topAtoms`; import `extractTags` |
| `services/memory/memorySupersession.ts` | Skip `'note'` |
| `services/ai/tools/memoryFileTools.ts` | Kind coercion derived from `MEMORY_FILE_TYPES` |
| `services/ai/tools/definitions.ts` | `memory_list` enum derived from `MEMORY_FILE_TYPES` |
| `services/journal/journalStorage.types.ts` | `JournalEntry.origin` |
| `services/journal/journalStorage.ts` | Accept + preserve `origin` |
| `components/memory/memoryDisplay.ts` | `topMemoryThemes` note-inclusive; `formatLedgerDate`, `themesForText`, `originLabel` |
| `components/memory/MemoryHubScreen.tsx` | The ledger port |
| `components/memory/MemoryPortrait.tsx` | Note-inclusive themes; hosts the drift strip |
| `components/memory/MemoryEmpty.tsx`, `MemoryHubSkeleton.tsx` | Rebuild to the new layout |
| `components/memory/index.ts` | Barrel |
| `hooks/memory/useLocalMemories.ts` | `addExploreNote`; drop generated-note API |
| `hooks/history/historyUtils.ts` | `HistoryItem.origin` |
| `components/history/HistoryEntryCard.tsx` | "Written on Threads" label |
| `app/entry-detail.tsx` | Origin on the authored label |

**Delete**

| Path | Why |
|---|---|
| `components/memory/MemoryNotesPanel.tsx` | The fake AI panel |
| `components/memory/MemoryAtomCard.tsx` + `__tests__/components/MemoryAtomCard.test.tsx` | Replaced by `MemoryLedgerRow` |

---

### Task 1: The `'note'` memory-file type, with a derived allowlist

**Why this is task 1:** `isHeader` (`memoryFiles.ts:205`) hardcodes `h.type === 'user' || 'feedback' || 'project'`, and `sanitizeManifest` runs it on **every** `loadManifest()`. Adding `'note'` to the type alone would make every note header get **silently dropped on the next read** — the note would vanish with no error. The spec caught the tool allowlist (`memoryFileTools.ts:75`) but not this one, which is strictly worse. Derive both from one list so neither can drift.

**Files:**
- Modify: `services/memory/memoryFiles.ts:14`, `:198-208`
- Test: `__tests__/services/memory/memoryNoteFiles.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `MEMORY_FILE_TYPES: readonly ['user','feedback','project','note']`, `MemoryFileType` derived from it.

- [ ] **Step 1: Write the failing test**

Create `__tests__/services/memory/memoryNoteFiles.test.ts`:

```ts
import {
    clearMemoryFiles,
    getMemoryRecordsByIds,
    listMemoryFiles,
    MEMORY_FILE_BODY_PREFIX,
    MEMORY_FILES_MANIFEST_KEY,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
} from '../../../services/memory/memoryFiles';

function createAdapter() {
    const store = new Map<string, string>();
    return {
        store,
        getItem: jest.fn(async (key: string) => store.get(key) ?? null),
        setItem: jest.fn(async (key: string, value: string) => {
            store.set(key, value);
        }),
        removeItem: jest.fn(async (key: string) => {
            store.delete(key);
        }),
    };
}

/** Write a note header straight into the manifest, as the store would. */
function seedNoteHeader(adapter: ReturnType<typeof createAdapter>): string {
    const id = 'projects/_tmp/Note/calm-mornings-abc.md';
    adapter.store.set(MEMORY_FILES_MANIFEST_KEY, JSON.stringify({
        schemaVersion: 1,
        files: {
            [id]: {
                id,
                relativePath: id,
                name: 'Note: calm mornings help',
                description: 'Thread hint calm-mornings. calm mornings help me think.',
                type: 'note',
                scope: 'project',
                projectId: '_tmp',
                updatedAt: '2026-09-19T10:00:00.000Z',
                capturedAt: '2026-09-19T10:00:00.000Z',
                sourceSessionKey: 'entry_1_abc',
            },
        },
    }));
    adapter.store.set(`${MEMORY_FILE_BODY_PREFIX}${id}`, '## Note\ncalm mornings help me think.');
    return id;
}

describe("memory files: the 'note' type", () => {
    it('keeps a note header through a manifest round-trip instead of sanitising it away', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            const id = seedNoteHeader(adapter);
            const headers = await listMemoryFiles({});
            expect(headers.map((h) => h.id)).toEqual([id]);
            expect(headers[0]?.type).toBe('note');
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });

    it('loads a note body by exact id', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            const id = seedNoteHeader(adapter);
            const records = await getMemoryRecordsByIds([id]);
            expect(records).toHaveLength(1);
            expect(records[0]?.content).toContain('calm mornings');
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --runInBand __tests__/services/memory/memoryNoteFiles.test.ts`
Expected: FAIL — `expect(received).toEqual(expected)` with `received: []`. `isHeader` rejects `type: 'note'`, so `sanitizeManifest` drops the header.

- [ ] **Step 3: Derive the type and the validator from one list**

In `services/memory/memoryFiles.ts`, replace line 14:

```ts
/**
 * The one list. `isHeader` validates against it and the `memory_list` tool
 * derives its accepted kinds from it, because both previously hardcoded their
 * own copy: adding a type updated one and not the other, and the failure mode
 * was silence (a header dropped on load, or a filter that returned everything).
 */
export const MEMORY_FILE_TYPES = ['user', 'feedback', 'project', 'note'] as const;
export type MemoryFileType = (typeof MEMORY_FILE_TYPES)[number];
```

Replace the `isHeader` type check (currently `memoryFiles.ts:205`):

```ts
        && typeof h.type === 'string'
        && (MEMORY_FILE_TYPES as readonly string[]).includes(h.type)
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest --runInBand __tests__/services/memory/memoryNoteFiles.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Sabotage check**

Revert the `isHeader` line to the hardcoded three-type check, run the test, confirm it goes RED with `received: []`, then restore the derived check and confirm GREEN. Paste both outputs into the task notes.

- [ ] **Step 6: Commit**

```bash
git add services/memory/memoryFiles.ts __tests__/services/memory/memoryNoteFiles.test.ts
git commit -m "feat(memory): add the 'note' file type behind one shared allowlist"
```

---

### Task 2: `stageUserNoteMemory` — the note writer

**Files:**
- Modify: `services/memory/memoryFiles.ts` (add after `stageTmpMemory`, ~line 293)
- Test: `__tests__/services/memory/memoryNoteFiles.test.ts` (append)

**Interfaces:**
- Consumes: `MEMORY_FILE_TYPES`, `idWithoutOverwriting`, `withFilesLock`, `loadManifest`, `saveManifest`, `bodyKey`, `slugify`, `hashText`, `normalizeText` — all already in `memoryFiles.ts`.
- Produces:
  ```ts
  export interface StageUserNoteInput {
      text: string;
      threadHint?: string;
      sourceEntryId: string;
      capturedAt?: string;
  }
  export async function stageUserNoteMemory(input: StageUserNoteInput): Promise<MemoryFileRecord>;
  ```

- [ ] **Step 1: Write the failing test**

Append to `__tests__/services/memory/memoryNoteFiles.test.ts` (add `stageUserNoteMemory` and `listTmpFiles` to the import list at the top):

```ts
describe('stageUserNoteMemory', () => {
    it('stages a note into _tmp with the thread hint Dream clusters on', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            const record = await stageUserNoteMemory({
                text: 'Calm mornings help me think straight.',
                threadHint: 'mornings',
                sourceEntryId: 'entry_1_abc',
                capturedAt: '2026-09-19T10:00:00.000Z',
            });
            expect(record.type).toBe('note');
            expect(record.scope).toBe('project');
            expect(record.projectId).toBe('_tmp');
            expect(record.description).toContain('Thread hint mornings.');
            expect(record.content).toContain('Calm mornings help me think straight.');
            expect(record.sourceSessionKey).toBe('entry_1_abc');
            expect(record.relativePath).toContain('projects/_tmp/Note/');
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });

    it('stages a hint-less note with a non-empty description so Dream still files it', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            const record = await stageUserNoteMemory({
                text: 'It was a day.',
                sourceEntryId: 'entry_2_def',
            });
            expect(record.description).not.toContain('Thread hint');
            expect(record.description.length).toBeGreaterThan(0);
            expect(record.name).toContain('Note:');
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });

    it('rejects empty text and writes nothing', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            await expect(stageUserNoteMemory({ text: '   ', sourceEntryId: 'e1' }))
                .rejects.toThrow('text is required');
            await expect(listTmpFiles()).resolves.toEqual([]);
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });

    it('gives two identical notes two distinct files, one per entry', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            const a = await stageUserNoteMemory({ text: 'Same words.', sourceEntryId: 'entry_a' });
            const b = await stageUserNoteMemory({ text: 'Same words.', sourceEntryId: 'entry_b' });
            expect(a.id).not.toBe(b.id);
            await expect(listTmpFiles()).resolves.toHaveLength(2);
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --runInBand __tests__/services/memory/memoryNoteFiles.test.ts -t stageUserNoteMemory`
Expected: FAIL — `TypeError: stageUserNoteMemory is not a function`.

- [ ] **Step 3: Implement the writer**

Add to `services/memory/memoryFiles.ts` immediately after `stageTmpMemory` ends (after line 293):

```ts
export interface StageUserNoteInput {
    text: string;
    /** Top tag from `extractTags` — becomes the thread hint. Absent when nothing was recognised. */
    threadHint?: string;
    /** Journal entry id; used for staging idempotency. */
    sourceEntryId: string;
    capturedAt?: string;
}

/** Lowercase slug used as the `Thread hint` token Dream clusters on. */
function noteHintSlug(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
}

/**
 * Stage a user-written note as a first-class memory file.
 *
 * Deliberately not `stageTmpMemory`: that writer's `type` union and its
 * `Project/` folder naming are for extracted memories, and widening it would let
 * a caller stage a note under a folder that says otherwise. A note is its own
 * kind of thing with its own id shape.
 *
 * The id is keyed on the **entry id**, not on the text. Two byte-identical notes
 * kept on different days are two memories, and hashing only the text would give
 * them one id and let the second silently overwrite the first's session key.
 *
 * The `Thread hint <slug>.` prefix is the exact convention `clusterTmpFiles`
 * groups on (`memoryDream.ts:43-46`), so Dream files a note beside the journal
 * memories of the same subject rather than in a separate pile.
 */
export async function stageUserNoteMemory(input: StageUserNoteInput): Promise<MemoryFileRecord> {
    const text = input.text.trim();
    if (!text) throw new Error('text is required');
    const entryKey = input.sourceEntryId.trim();
    if (!entryKey) throw new Error('sourceEntryId is required');

    const hint = noteHintSlug(input.threadHint ?? '');
    const name = `Note: ${normalizeText(text).slice(0, 60)}`;
    const description = (
        normalizeText(`${hint ? `Thread hint ${hint}. ` : ''}${text}`).slice(0, 320) || name
    );
    const body = ['## Note', text, '', '## Notes', '- Kept as written on Threads.'].join('\n');
    const capturedAt = input.capturedAt && Number.isFinite(Date.parse(input.capturedAt))
        ? input.capturedAt
        : nowIso();
    const baseId = `projects/${TMP_PROJECT_ID}/Note/${slugify(normalizeText(text).slice(0, 48))}-${hashText(entryKey)}.md`;

    let record: MemoryFileRecord | undefined;
    await withFilesLock(async () => {
        const manifest = await loadManifest();
        const id = await idWithoutOverwriting(manifest, body, baseId);
        const header: MemoryFileHeader = {
            id,
            relativePath: id,
            name,
            description,
            type: 'note',
            scope: 'project',
            projectId: TMP_PROJECT_ID,
            updatedAt: nowIso(),
            capturedAt,
            sourceSessionKey: entryKey,
        };
        // Body first: an orphan body is reclaimable, a header with no bytes is
        // an unreachable memory (see `promoteTmpRecord` for the full reasoning).
        await storageAdapter.setItem(bodyKey(id), body);
        manifest[id] = header;
        await saveManifest(manifest);
        record = { ...header, content: body, preview: previewText(body, HEADER_PREVIEW_CHARS) };
    });
    if (!record) throw new Error('note staging did not run');
    return record;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest --runInBand __tests__/services/memory/memoryNoteFiles.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add services/memory/memoryFiles.ts __tests__/services/memory/memoryNoteFiles.test.ts
git commit -m "feat(memory): stage user notes as first-class memory files"
```

---

### Task 3: Body-first write ordering + orphan reconciliation (the carve-out)

**Why now:** `promoteTmpRecord` (`memoryFiles.ts:526-527`) and `stageTmpMemory` (`:285-286`) write the manifest *before* the body. A kill between the two leaves a header with no bytes, its `_tmp` source already deprecated, and no pass that notices — `getMemoryRecordsByIds:380` silently skips a missing body, so the memory is unreachable **permanently**. This is live data loss and is independent of the Dream agent.

**Files:**
- Modify: `services/memory/memoryFiles.ts:284-286`, `:526-527`, `:376-383`
- Test: `__tests__/services/memory/memoryNoteFiles.test.ts` (append)

**Interfaces:**
- Consumes: `loadManifest`, `bodyKey`, `storageAdapter`.
- Produces: `findOrphanManifestHeaders(): Promise<MemoryFileHeader[]>`.

- [ ] **Step 1: Write the failing test**

Append to `__tests__/services/memory/memoryNoteFiles.test.ts` (add `findOrphanManifestHeaders`, `promoteTmpRecord`, `stageTmpMemory` to imports):

```ts
describe('write ordering: body before header', () => {
    it('leaves no dangling header when the manifest write fails during staging', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            // Kill the app at the moment the manifest would have been saved.
            const realSetItem = adapter.setItem.getMockImplementation()!;
            adapter.setItem.mockImplementation(async (key: string, value: string) => {
                if (key === MEMORY_FILES_MANIFEST_KEY) throw new Error('process killed');
                await realSetItem(key, value);
            });
            await expect(stageTmpMemory({
                type: 'project', name: 'Doomed', description: 'd', body: '## Current Stage\nx',
            })).rejects.toThrow('process killed');
            adapter.setItem.mockImplementation(realSetItem);

            // The header never landed, so nothing references the orphan body.
            await expect(findOrphanManifestHeaders()).resolves.toEqual([]);
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });

    it('leaves no dangling header when the manifest write fails during promotion', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            const staged = await stageTmpMemory({
                type: 'project', name: 'Promote me', description: 'd',
                body: '## Current Stage\ncontent worth keeping',
            });
            const realSetItem = adapter.setItem.getMockImplementation()!;
            adapter.setItem.mockImplementation(async (key: string, value: string) => {
                if (key === MEMORY_FILES_MANIFEST_KEY) throw new Error('process killed');
                await realSetItem(key, value);
            });
            await expect(promoteTmpRecord(staged.id, 'work')).rejects.toThrow('process killed');
            adapter.setItem.mockImplementation(realSetItem);

            // The _tmp source is still live and still promotable — nothing was lost.
            const headers = await listMemoryFiles({});
            expect(headers.map((h) => h.id)).toEqual([staged.id]);
            await expect(findOrphanManifestHeaders()).resolves.toEqual([]);
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });

    it('reports a header whose body is missing', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            const id = seedNoteHeader(adapter);
            adapter.store.delete(`@blackrose_memory_file:${id}`);
            const orphans = await findOrphanManifestHeaders();
            expect(orphans.map((h) => h.id)).toEqual([id]);
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --runInBand __tests__/services/memory/memoryNoteFiles.test.ts -t "write ordering"`
Expected: FAIL — `TypeError: findOrphanManifestHeaders is not a function`; and the first two tests fail with a dangling header present (`received: [ {...} ]` vs `[]`) because the manifest is written first.

- [ ] **Step 3: Reorder both writers**

In `stageTmpMemory`, replace:

```ts
        manifest[id] = header;
        await saveManifest(manifest);
        await storageAdapter.setItem(bodyKey(id), body);
```

with:

```ts
        // Body first, header second. An orphan body key is unreferenced and
        // reclaimable; a header with no bytes is an unreachable memory, because
        // every reader skips a missing body in silence.
        await storageAdapter.setItem(bodyKey(id), body);
        manifest[id] = header;
        await saveManifest(manifest);
```

In `promoteTmpRecord`, replace:

```ts
        await saveManifest(manifest);
        await storageAdapter.setItem(bodyKey(newId), body);
```

with:

```ts
        // Same ordering as staging, and here it also protects the source: the
        // `_tmp` original is deprecated in this same manifest save, so a crash
        // after the save but before the body write would retire the source while
        // the promoted copy had no bytes — losing the memory outright.
        await storageAdapter.setItem(bodyKey(newId), body);
        await saveManifest(manifest);
```

- [ ] **Step 4: Surface existing orphans where they bite**

In `getMemoryRecordsByIds`, replace the silent skip:

```ts
        const body = await storageAdapter.getItem(bodyKey(id));
        if (typeof body !== 'string') continue;
```

with:

```ts
        const body = await storageAdapter.getItem(bodyKey(id));
        if (typeof body !== 'string') {
            // A header with no bytes is a memory nobody can read. Writes are
            // body-first now, so this is either pre-fix data or a body removed
            // out of band — either way it must not disappear in silence.
            console.warn(`Memory file ${id} has a manifest header but no body; skipping.`);
            continue;
        }
```

Then add, immediately after `listTmpFiles`:

```ts
/**
 * Manifest headers whose body key is missing — a memory that exists on paper and
 * nowhere else. Every reader skips these silently, so without this they are
 * invisible forever. Reporting only: the body is gone, so there is nothing to
 * repair; the point is to stop the loss being silent.
 *
 * Writes are body-first, so a crash cannot create a new one of these.
 */
export async function findOrphanManifestHeaders(): Promise<MemoryFileHeader[]> {
    return withFilesLock(async () => {
        const manifest = await loadManifest();
        const orphans: MemoryFileHeader[] = [];
        for (const header of Object.values(manifest)) {
            const body = await storageAdapter.getItem(bodyKey(header.id));
            if (typeof body !== 'string') orphans.push(header);
        }
        return orphans;
    });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest --runInBand __tests__/services/memory/memoryNoteFiles.test.ts`
Expected: PASS, 9 tests.

Then run the existing store suites for regressions:

Run: `npx jest --runInBand __tests__/services/memoryFiles.test.ts __tests__/services/memoryRetrieval.test.ts __tests__/services/memory/memoryFileTools.test.ts`
Expected: PASS.

- [ ] **Step 6: Sabotage check**

Restore the manifest-first ordering in `promoteTmpRecord`, confirm the promotion test goes RED with a dangling header, restore body-first, confirm GREEN.

- [ ] **Step 7: Commit**

```bash
git add services/memory/memoryFiles.ts __tests__/services/memory/memoryNoteFiles.test.ts
git commit -m "fix(memory): write bodies before manifest headers; report orphan headers"
```

---

### Task 4: Notes are never superseded

**Why:** `memorySupersession.ts:125` protects only `type === 'user'`. Without this, a note could be auto-deprecated as "restated by a newer memory in the same thread" — user-written words are undeletable by doctrine.

**Files:**
- Modify: `services/memory/memorySupersession.ts:124-126`
- Test: `__tests__/services/memory/memoryNoteFiles.test.ts` (append)

**Interfaces:**
- Consumes: `supersedeRestatedMemoriesInThread`.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Append (add `importMemoryFiles` and `supersedeRestatedMemoriesInThread` to imports):

```ts
describe('supersession leaves notes alone', () => {
    it('never deprecates a note even when a newer memory restates it', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            const body = '## Note\nCalm mornings help me think straight and plan the day.';
            await importMemoryFiles([{
                header: {
                    id: 'projects/work/Project/morning-note.md',
                    relativePath: 'projects/work/Project/morning-note.md',
                    name: 'Note: calm mornings',
                    description: 'Thread hint mornings.',
                    type: 'note',
                    scope: 'project',
                    projectId: 'work',
                    updatedAt: '2026-09-01T10:00:00.000Z',
                    capturedAt: '2026-09-01T10:00:00.000Z',
                },
                content: body,
            }, {
                header: {
                    id: 'projects/work/Project/morning-restated.md',
                    relativePath: 'projects/work/Project/morning-restated.md',
                    name: 'Morning pattern',
                    description: 'Thread hint mornings.',
                    type: 'project',
                    scope: 'project',
                    projectId: 'work',
                    updatedAt: '2026-09-10T10:00:00.000Z',
                    capturedAt: '2026-09-10T10:00:00.000Z',
                },
                content: `${body} And the rest of the day follows.`,
            }]);

            const outcome = await supersedeRestatedMemoriesInThread('work');

            expect(outcome.superseded).toBe(0);
            const headers = await listMemoryFiles({});
            expect(headers.map((h) => h.type)).toContain('note');
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --runInBand __tests__/services/memory/memoryNoteFiles.test.ts -t "supersession"`
Expected: FAIL — `expect(outcome.superseded).toBe(0)` receives `1`; the note is deprecated.

- [ ] **Step 3: Add `'note'` to the skip list**

In `services/memory/memorySupersession.ts`, replace the `scoped` filter:

```ts
    // `user` and `note` files carry the writer's own words, and supersession's
    // whole job is deciding that a newer memory *replaces* an older one — which
    // is not a judgement to make about something the user typed. Promotion owns
    // the `_tmp` backlog: a staged file deprecated here would vanish from
    // `listTmpFiles` before Dream ever got to promote it. Both entry points
    // filter here so the invariant lives in one place.
    const scoped = headers.filter(
        (header: MemoryFileHeader) => header.type !== 'user'
            && header.type !== 'note'
            && header.projectId !== TMP_PROJECT_ID,
    );
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest --runInBand __tests__/services/memory/memoryNoteFiles.test.ts __tests__/services/memory/memorySupersession.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/memory/memorySupersession.ts __tests__/services/memory/memoryNoteFiles.test.ts
git commit -m "fix(memory): never supersede user-written notes"
```

---

### Task 5: `memory_list` kind coercion derives from the type list

**Why:** `memoryFileTools.ts:75` hardcodes the three kinds. Adding `'note'` to the type alone would make `memory_list({"kind":"note"})` **silently return all kinds** — no error, wrong answer. Same for the tool schema enum at `definitions.ts:130`.

**Files:**
- Modify: `services/ai/tools/memoryFileTools.ts:74-77`, `services/ai/tools/definitions.ts:130`
- Modify: `__tests__/services/ai/toolSchemaPin.test.ts:143-153`
- Test: `__tests__/services/memory/memoryNoteFiles.test.ts` (append)

**Interfaces:**
- Consumes: `MEMORY_FILE_TYPES` from `services/memory/memoryFiles`.
- Produces: nothing new; the `memory_list` enum gains `"note"`.

- [ ] **Step 1: Write the failing test**

Append (add `memoryListTool` import from `'../../../services/ai/tools/memoryFileTools'`):

```ts
describe('memory_list kind coercion', () => {
    it('filters to notes for kind=note instead of silently returning everything', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            await stageUserNoteMemory({ text: 'A note about the kiln.', sourceEntryId: 'e1' });
            await stageTmpMemory({
                type: 'project', name: 'Kiln', description: 'kiln project',
                body: '## Current Stage\nkiln work', projectId: 'kiln',
            });

            const notes = await memoryListTool({ kind: 'note' });
            expect(notes).toContain('[note]');
            expect(notes).not.toContain('[project]');
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });

    it('falls back to all kinds for an unrecognised kind', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            await stageUserNoteMemory({ text: 'A note about the kiln.', sourceEntryId: 'e1' });
            await stageTmpMemory({
                type: 'project', name: 'Kiln', description: 'kiln project',
                body: '## Current Stage\nkiln work', projectId: 'kiln',
            });

            const all = await memoryListTool({ kind: 'nonsense' });
            expect(all).toContain('[note]');
            expect(all).toContain('[project]');
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --runInBand __tests__/services/memory/memoryNoteFiles.test.ts -t "kind coercion"`
Expected: FAIL — the first test's `not.toContain('[project]')` fails, because `'note'` is not in the hardcoded allowlist so the coercion returns `'all'`.

- [ ] **Step 3: Derive the coercion**

In `services/ai/tools/memoryFileTools.ts`, add `MEMORY_FILE_TYPES` to the existing `memoryFiles` import, then replace lines 74-77:

```ts
    const kindRaw = asString(args.kind)?.toLowerCase() ?? 'all';
    // Derived, never a second copy of the list. A hardcoded allowlist here meant
    // a kind the store supports but this line does not know about fell through to
    // `all` — the tool answered a narrower question than it was asked, and said
    // nothing. `MEMORY_FILE_TYPES` is the store's own list, so the two cannot drift.
    const kind: 'all' | MemoryFileType = kindRaw === 'all'
        ? 'all'
        : (MEMORY_FILE_TYPES as readonly string[]).includes(kindRaw)
            ? (kindRaw as MemoryFileType)
            : 'all';
```

In `services/ai/tools/definitions.ts`, add at the top:

```ts
import { MEMORY_FILE_TYPES } from '@/services/memory/memoryFiles';
```

and replace line 130:

```ts
                kind: { type: 'string', enum: ['all', ...MEMORY_FILE_TYPES] },
```

- [ ] **Step 4: Update the schema pin**

Run: `npx jest --runInBand __tests__/services/ai/toolSchemaPin.test.ts`
Expected: FAIL, printing the new `memory_list` spec in the diff.

In `__tests__/services/ai/toolSchemaPin.test.ts`, add `"note"` after `"project"` in the frozen `memory_list` `kind` enum (around line 148-153), and extend the file's header comment:

```ts
/**
 * PR8c: tool schemas OTHER than list_recent_days stay byte-identical.
 * list_recent_days may gain optional order/from/to — nothing else may drift.
 *
 * Toolfix (2026-09): descriptions were DELIBERATELY rewritten (verb +
 * when-use + when-NOT-use + arg example) and the pin re-frozen below.
 * Explore (2026-09-19): `memory_list.kind` gained "note" because user-written
 * notes became first-class memory files. The enum is now derived from
 * `MEMORY_FILE_TYPES`, so this pin is what still catches a drift.
 * Parameters/required must still not drift without a matching pin update.
 */
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest --runInBand __tests__/services/memory/memoryNoteFiles.test.ts __tests__/services/ai/toolSchemaPin.test.ts __tests__/services/memory/memoryFileTools.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add services/ai/tools/memoryFileTools.ts services/ai/tools/definitions.ts \
        __tests__/services/ai/toolSchemaPin.test.ts __tests__/services/memory/memoryNoteFiles.test.ts
git commit -m "fix(tools): derive memory_list kinds from the store's type list"
```

---

### Task 6: Journal entry provenance

**Files:**
- Modify: `services/journal/journalStorage.types.ts:18-40`, `services/journal/journalStorage.ts:113-122`
- Test: `__tests__/services/journalStorageOrigin.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `JournalEntry.origin?: 'chat' | 'threads'`, `JournalEntryCreateInput.origin?: 'chat' | 'threads'`, and a `NoteOrigin` type exported from `journalStorage.types.ts`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/services/journalStorageOrigin.test.ts`:

```ts
import {
    clearAllEntries,
    createEntry,
    getEntry,
    importJournalEntriesSnapshot,
    resetStorageAdapter,
    setStorageAdapter,
} from '../../services/journal/journalStorage';
import type { StorageAdapter } from '../../services/journal/journalStorage.types';

function createAdapter(): StorageAdapter {
    const store = new Map<string, string>();
    return {
        getItem: (key) => Promise.resolve(store.get(key) ?? null),
        setItem: (key, value) => {
            store.set(key, value);
            return Promise.resolve();
        },
        removeItem: (key) => {
            store.delete(key);
            return Promise.resolve();
        },
    };
}

const message = { id: 'm1', role: 'user' as const, content: 'Calm mornings help.', timestamp: 1 };

describe('journal entry origin', () => {
    beforeEach(() => setStorageAdapter(createAdapter()));
    afterEach(async () => {
        await clearAllEntries();
        resetStorageAdapter();
    });

    it("records 'threads' for a note written on Explore", async () => {
        const entry = await createEntry({ messages: [message], status: 'completed', origin: 'threads' });
        expect(entry.origin).toBe('threads');
        await expect(getEntry(entry.id)).resolves.toMatchObject({ origin: 'threads' });
    });

    it("leaves origin undefined for a chat entry, so old readers are unaffected", async () => {
        const entry = await createEntry({ messages: [message], status: 'completed' });
        expect(entry.origin).toBeUndefined();
    });

    it('preserves origin through an export/import round-trip', async () => {
        const entry = await createEntry({ messages: [message], status: 'completed', origin: 'threads' });
        const snapshot = JSON.stringify({ [entry.id]: entry });
        await importJournalEntriesSnapshot(snapshot);
        await expect(getEntry(entry.id)).resolves.toMatchObject({ origin: 'threads' });
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --runInBand __tests__/services/journalStorageOrigin.test.ts`
Expected: FAIL — `expect(entry.origin).toBe('threads')` receives `undefined`.

- [ ] **Step 3: Add the field**

In `services/journal/journalStorage.types.ts`, add above `JournalEntry`:

```ts
/**
 * Where an entry was written. Absent on entries saved before this field existed,
 * so every reader treats `undefined` as `'chat'` — the journal was the only
 * writer until Explore gained a composer.
 */
export type NoteOrigin = 'chat' | 'threads';
```

and add to `JournalEntry` after `updatedAt`:

```ts
    /** Where this entry was written. Absent on older entries → read as 'chat'. */
    origin?: NoteOrigin;
```

and to `JournalEntryCreateInput` after `updatedAt`:

```ts
    origin?: NoteOrigin;
```

In `services/journal/journalStorage.ts`, inside `createEntry`'s `entry` object literal (after `updatedAt`):

```ts
            ...(input.origin ? { origin: input.origin } : {}),
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest --runInBand __tests__/services/journalStorageOrigin.test.ts`
Expected: PASS, 3 tests.

Note on AGENTS.md rule 4: the journal store has **no** `schemaVersion` envelope today. Adding an *optional* field that readers default is backward compatible in both directions, so no envelope is required. If a later change touches a required field or reinterprets an existing one, the envelope becomes mandatory and must be added first.

- [ ] **Step 5: Commit**

```bash
git add services/journal/journalStorage.types.ts services/journal/journalStorage.ts \
        __tests__/services/journalStorageOrigin.test.ts
git commit -m "feat(journal): record where an entry was written"
```

---

### Task 7: Move `extractTags` to the shared pure module

**Why:** Both the write path (`exploreNote.ts`) and the composer's live preview need `extractTags`. It currently lives unexported in `localMemory.ts`, an I/O module. Moving it to `keywordRanking.ts` (already the shared, pure, zero-import home of `tokenize`) lets a component call it without pulling the memory store into the bundle graph.

**Files:**
- Modify: `services/memory/keywordRanking.ts`, `services/memory/localMemory.ts:115-120`
- Test: `__tests__/services/keywordRanking.test.ts`

**Interfaces:**
- Consumes: `tokenize` (already there).
- Produces: `extractTags(text: string, seedTags?: readonly string[]): string[]` from `services/memory/keywordRanking`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/services/keywordRanking.test.ts`:

```ts
import { extractTags } from '../../services/memory/keywordRanking';

describe('extractTags', () => {
    it('ranks tokens by frequency and drops short words and stopwords', () => {
        expect(extractTags('mornings calm mornings help me think mornings'))
            .toEqual(['mornings', 'calm', 'help', 'think']);
    });

    it('returns an empty list when nothing survives tokenization', () => {
        expect(extractTags('it was a day')).toEqual([]);
    });

    it('keeps seed tags ahead of derived ones', () => {
        expect(extractTags('calm mornings', ['intention'])).toEqual(['intention', 'calm', 'mornings']);
    });

    it('caps derived tags at eight', () => {
        expect(extractTags('alpha bravo charlie delta echo foxtrot golf hotel india juliet'))
            .toHaveLength(8);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --runInBand __tests__/services/keywordRanking.test.ts`
Expected: FAIL — `TypeError: extractTags is not a function` (or a TS error on the named import).

- [ ] **Step 3: Move the function**

Append to `services/memory/keywordRanking.ts`:

```ts
/** Dedupe, trim, drop empties — insertion order preserved. */
function uniqueValues(values: readonly string[]): string[] {
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

/**
 * Top tags for a piece of text: the highest-frequency tokens, seed tags first.
 *
 * Lives here rather than in `localMemory.ts` because it is pure and two callers
 * need it — the memory store and the Explore composer's live "Filed under"
 * preview. Importing the store for a pure string function dragged the whole
 * AsyncStorage write path into the component graph.
 */
export function extractTags(text: string, seedTags: readonly string[] = []): string[] {
    const counts = new Map<string, number>();
    tokenize(text).forEach((token) => counts.set(token, (counts.get(token) ?? 0) + 1));
    const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    return uniqueValues([...seedTags, ...ranked.slice(0, 8).map(([token]) => token)]);
}
```

In `services/memory/localMemory.ts`, delete the local `extractTags` definition (lines 115-120) and add `extractTags` to the existing import from `'./keywordRanking'`:

```ts
import {
    extractTags,
    scoreKeywordRecency,
    tokenize,
} from './keywordRanking';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest --runInBand __tests__/services/keywordRanking.test.ts __tests__/services/localMemory.test.ts`
Expected: PASS. The `localMemory` suite is the characterization check — its six `extractTags` call sites must behave identically.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (`tokenize` may now be unused in `localMemory.ts` — remove it from the import if `tsc` or lint flags it.)

- [ ] **Step 6: Commit**

```bash
git add services/memory/keywordRanking.ts services/memory/localMemory.ts __tests__/services/keywordRanking.test.ts
git commit -m "refactor(memory): share extractTags from the pure ranking module"
```

---

### Task 8: `saveExploreNote` — the four-store fan-out

**Files:**
- Create: `services/memory/exploreNote.ts`
- Test: `__tests__/services/exploreNote.test.ts`, `__tests__/services/exploreNoteImports.test.ts`

**Interfaces:**
- Consumes: `createEntry` (`services/journal/journalStorage`), `upsertJournalDayDigest` (`./dayDigestStorage`), `upsertMemoryAtom` (`./localMemory`), `stageUserNoteMemory` (`./memoryFiles`), `extractTags` (`./keywordRanking`).
- Produces:
  ```ts
  export const MAX_EXPLORE_NOTE_CHARS = 600;
  export type ExploreNoteStore = 'atom' | 'file' | 'digest';
  export interface ExploreNoteFailure { store: ExploreNoteStore; message: string; }
  export interface ExploreNoteInput { text: string; now?: number; }
  export interface ExploreNoteResult {
      entry: JournalEntry;
      atom: LocalMemoryAtom | null;
      file: MemoryFileRecord | null;
      failures: ExploreNoteFailure[];
      themes: string[];
  }
  export function deriveNoteTitle(text: string): string;
  export async function saveExploreNote(input: ExploreNoteInput): Promise<ExploreNoteResult>;
  ```

- [ ] **Step 1: Write the failing test**

Create `__tests__/services/exploreNote.test.ts`:

```ts
/* eslint-disable import/first */

jest.mock('@/services/memory/memoryAtomExtraction', () => ({
    extractJournalMemoryAtoms: jest.fn(async () => []),
    extractCheckInMemoryAtoms: jest.fn(async () => []),
}));

import { deriveNoteTitle, saveExploreNote } from '../../services/memory/exploreNote';
import { listMemoryAtoms, resetMemoryStorageAdapter, setMemoryStorageAdapter } from '../../services/memory/localMemory';
import {
    clearMemoryFiles,
    listTmpFiles,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
} from '../../services/memory/memoryFiles';
import {
    getDayDigest,
    resetDayDigestStorageAdapter,
    setDayDigestStorageAdapter,
} from '../../services/memory/dayDigestStorage';
import {
    clearAllEntries,
    getEntry,
    resetStorageAdapter,
    setStorageAdapter,
} from '../../services/journal/journalStorage';
import type { StorageAdapter } from '../../services/journal/journalStorage.types';

function createAdapter(): StorageAdapter & { store: Map<string, string> } {
    const store = new Map<string, string>();
    return {
        store,
        getItem: (key) => Promise.resolve(store.get(key) ?? null),
        setItem: (key, value) => {
            store.set(key, value);
            return Promise.resolve();
        },
        removeItem: (key) => {
            store.delete(key);
            return Promise.resolve();
        },
    };
}

const NOW = Date.UTC(2026, 8, 19, 10, 0, 0);

describe('saveExploreNote', () => {
    beforeEach(() => {
        setStorageAdapter(createAdapter());
        setMemoryStorageAdapter(createAdapter());
        setMemoryFilesStorageAdapter(createAdapter());
        // The digest store keeps its own adapter; without this the write lands in
        // the jest AsyncStorage mock and the digest assertions read nothing back.
        setDayDigestStorageAdapter(createAdapter());
    });

    afterEach(async () => {
        await clearAllEntries();
        await clearMemoryFiles();
        resetStorageAdapter();
        resetMemoryStorageAdapter();
        resetMemoryFilesStorageAdapter();
        resetDayDigestStorageAdapter();
    });

    it('writes all four stores for one kept note', async () => {
        const result = await saveExploreNote({
            text: 'Calm mornings help me think straight about the work.',
            now: NOW,
        });

        // 1. journal entry
        await expect(getEntry(result.entry.id)).resolves.toMatchObject({ origin: 'threads', status: 'completed' });
        // 2. memory atom
        const atoms = await listMemoryAtoms();
        expect(atoms).toHaveLength(1);
        expect(atoms[0]?.layer).toBe('note');
        expect(atoms[0]?.content).toContain('Calm mornings help me think straight');
        // 3. memory file
        const files = await listTmpFiles();
        expect(files).toHaveLength(1);
        expect(files[0]?.type).toBe('note');
        // 4. day digest
        await expect(getDayDigest('2026-09-19')).resolves.toMatchObject({ entryCount: 1 });
        expect(result.failures).toEqual([]);
    });

    it('rejects blank text before writing anything', async () => {
        await expect(saveExploreNote({ text: '   \n  ', now: NOW })).rejects.toThrow('Note text is required');
        await expect(listMemoryAtoms()).resolves.toEqual([]);
        await expect(listTmpFiles()).resolves.toEqual([]);
    });

    it('feeds one clipped value to every store so recall returns what the composer showed', async () => {
        const long = 'lighthouse '.repeat(120).trim(); // 1199 chars
        const result = await saveExploreNote({ text: long, now: NOW });

        const atoms = await listMemoryAtoms();
        const files = await listTmpFiles();
        const entry = await getEntry(result.entry.id);
        const entryText = entry?.messages[0]?.content ?? '';

        expect(entryText.length).toBe(600);
        expect(atoms[0]?.content).toBe(entryText);
        expect(files[0]?.name).toContain(entryText.slice(0, 40));
    });

    it('keeps the entry and reports the failure when a later store throws', async () => {
        // A files adapter that fails every body write — the store the note needs
        // most, so the failure path is exercised on the store that matters.
        const failing = {
            getItem: () => Promise.resolve(null),
            setItem: () => Promise.reject(new Error('disk full')),
            removeItem: () => Promise.resolve(),
        };
        setMemoryFilesStorageAdapter(failing);

        const result = await saveExploreNote({ text: 'A note worth keeping.', now: NOW });

        await expect(getEntry(result.entry.id)).resolves.toMatchObject({ status: 'completed' });
        expect(result.failures.map((f) => f.store)).toEqual(['file']);
        expect(result.atom).not.toBeNull();
        // The words survive even though the file write did not.
        await expect(listMemoryAtoms()).resolves.toHaveLength(1);
    });

    it('writes an atom that navigates back to the entry containing the note', async () => {
        const result = await saveExploreNote({ text: 'The kiln needs a new element.', now: NOW });
        const atoms = await listMemoryAtoms();
        expect(atoms[0]?.rootSourceKind).toBe('journal_entry');
        expect(atoms[0]?.rootSourceId).toBe(result.entry.id);
    });

    it('keeps the same text twice as two entries and two atoms', async () => {
        const first = await saveExploreNote({ text: 'Same words twice.', now: NOW });
        const second = await saveExploreNote({ text: 'Same words twice.', now: NOW + 1000 });
        expect(first.entry.id).not.toBe(second.entry.id);
        await expect(listMemoryAtoms()).resolves.toHaveLength(2);
        await expect(listTmpFiles()).resolves.toHaveLength(2);
    });

    it('merges into an existing day digest instead of clobbering it', async () => {
        await saveExploreNote({ text: 'Morning note about the kiln.', now: NOW });
        await saveExploreNote({ text: 'Evening note about the glaze.', now: NOW + 60_000 });
        const digest = await getDayDigest('2026-09-19');
        // Both sources survive — this is what proves the second write merged
        // rather than replaced the first.
        expect(digest?.entryCount).toBe(2);
        expect(digest?.sources).toHaveLength(2);
        expect(digest?.sources.map((s) => s.title)).toEqual(
            expect.arrayContaining(['Morning note about the kiln.', 'Evening note about the glaze.']),
        );
        // The summary is a rollup of titles plus the *latest* snippet, so only the
        // newer note's words appear here. Asserted explicitly so a future change to
        // that shape is caught rather than assumed.
        expect(digest?.summary).toContain('kiln');
        expect(digest?.summary).toContain('glaze');
    });

    it('derives a title from the first sentence, clipped at a word boundary', () => {
        expect(deriveNoteTitle('Calm mornings help. And so does sleep.'))
            .toBe('Calm mornings help.');
        const long = deriveNoteTitle('word '.repeat(40));
        expect(long.length).toBeLessThanOrEqual(61);
        expect(long.endsWith('…')).toBe(true);
        expect(long).not.toContain('wor…');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --runInBand __tests__/services/exploreNote.test.ts`
Expected: FAIL — `Cannot find module '../../services/memory/exploreNote'`.

- [ ] **Step 3: Implement the fan-out**

Create `services/memory/exploreNote.ts`:

```ts
import { createEntry } from '@/services/journal/journalStorage';
import type { JournalEntry } from '@/services/journal/journalStorage.types';
import { upsertJournalDayDigest } from './dayDigestStorage';
import { extractTags } from './keywordRanking';
import { upsertMemoryAtom } from './localMemory';
import type { LocalMemoryAtom } from './localMemory.types';
import { stageUserNoteMemory } from './memoryFiles';
import type { MemoryFileRecord } from './memoryFiles';

/**
 * Explore write path — one note, four stores.
 *
 * Mirrors `journalFinishSideEffects.ts`: one entry point owns the fan-out, so
 * "did every store get written?" is a testable question rather than four
 * scattered calls. Deterministic and offline: no model is called here, because
 * the page promises no AI in the loop and must keep that promise literally.
 * Identity extraction and session digests are the two finish-path side effects
 * that do call a model, and both are deferred to Dream.
 *
 * Write order is entry → atom → file → digest, and the order is load-bearing:
 * the entry is the user's actual words, so writing it first turns a partial
 * failure from "the writing is lost" into "the derived memory is incomplete,
 * and the words are still in Archive". That is the only acceptable direction.
 */

/** Matches the atom's own 600-char trim, so every store holds the same text. */
export const MAX_EXPLORE_NOTE_CHARS = 600;

export type ExploreNoteStore = 'atom' | 'file' | 'digest';

export interface ExploreNoteFailure {
    store: ExploreNoteStore;
    message: string;
}

export interface ExploreNoteInput {
    text: string;
    /** Injected for tests; defaults to Date.now(). */
    now?: number;
}

export interface ExploreNoteResult {
    entry: JournalEntry;
    /** Null when the atom write failed — see `failures`. */
    atom: LocalMemoryAtom | null;
    /** Null when the file write failed — see `failures`. */
    file: MemoryFileRecord | null;
    /** Stores that failed *after* the entry was durably written. */
    failures: ExploreNoteFailure[];
    themes: string[];
}

/**
 * First sentence, clipped at a word boundary.
 *
 * No model runs at write time, so the title is derived locally. The regex is a
 * plain prefix match rather than a lookbehind split: Hermes' lookbehind support
 * varies by version, and a title is not worth a runtime-only failure.
 */
export function deriveNoteTitle(text: string): string {
    const clean = text.trim().replace(/\s+/g, ' ');
    const match = /^[^.!?]*[.!?]/.exec(clean);
    const sentence = (match ? match[0] : clean).trim();
    if (sentence.length <= 60) return sentence;
    const clipped = sentence.slice(0, 60);
    const lastSpace = clipped.lastIndexOf(' ');
    const cut = lastSpace > 20 ? clipped.slice(0, lastSpace) : clipped;
    return `${cut.trim()}…`;
}

function messageOf(error: unknown): string {
    return error instanceof Error && error.message ? error.message : 'Unknown error';
}

export async function saveExploreNote(input: ExploreNoteInput): Promise<ExploreNoteResult> {
    const collapsed = input.text.trim().replace(/\s+/g, ' ');
    if (!collapsed) throw new Error('Note text is required.');
    // One clipped value, used by every store. Clipping per store is how the
    // atom ends up holding 600 chars while the entry holds 1200 — and then
    // recall returns text the writer never saw in that shape.
    const text = collapsed.length > MAX_EXPLORE_NOTE_CHARS
        ? collapsed.slice(0, MAX_EXPLORE_NOTE_CHARS).trimEnd()
        : collapsed;
    const now = input.now ?? Date.now();
    const themes = extractTags(text);
    const title = deriveNoteTitle(text);

    // 1. The user's words, durably, before anything derives from them. A throw
    //    here aborts the whole write and surfaces — nothing else is attempted.
    const entry = await createEntry({
        title,
        messages: [{ id: `note_${now}`, role: 'user', content: text, timestamp: now }],
        status: 'completed',
        createdAt: now,
        updatedAt: now,
        origin: 'threads',
    });

    const failures: ExploreNoteFailure[] = [];

    // 2. Atom — feeds the always-on capsule and gives the row a route back to
    //    the entry, since the note now *is* an entry.
    let atom: LocalMemoryAtom | null = null;
    try {
        atom = await upsertMemoryAtom({
            layer: 'note',
            source: 'manual',
            sourceId: entry.id,
            rootSourceId: entry.id,
            rootSourceKind: 'journal_entry',
            title,
            content: text,
            tags: themes,
            salience: 0.9,
            confidence: 1,
            createdAt: now,
        });
    } catch (error: unknown) {
        failures.push({ store: 'atom', message: messageOf(error) });
    }

    // 3. File — the bridge. This is what makes `memory_search` able to see the note.
    let file: MemoryFileRecord | null = null;
    try {
        file = await stageUserNoteMemory({
            text,
            threadHint: themes[0],
            sourceEntryId: entry.id,
            capturedAt: new Date(now).toISOString(),
        });
    } catch (error: unknown) {
        failures.push({ store: 'file', message: messageOf(error) });
    }

    // 4. Day digest — built from the entry's own text, never a model summary.
    try {
        await upsertJournalDayDigest(entry);
    } catch (error: unknown) {
        failures.push({ store: 'digest', message: messageOf(error) });
    }

    return { entry, atom, file, failures, themes };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest --runInBand __tests__/services/exploreNote.test.ts`
Expected: PASS, 8 tests.

If the digest test fails on `summary` content, check `buildDigestSummary` — it includes `Latest notes: <snippet>` from the entry's user text, so both "kiln" and "glaze" should appear. If it does not, assert on `topics` instead and note the deviation in the task notes rather than changing `dayDigestStorage`.

- [ ] **Step 5: Write the "no model call" guard**

Create `__tests__/services/exploreNoteImports.test.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';

/**
 * Success criterion 3 of the spec: no model call fires at write time.
 *
 * Asserted on the module graph rather than on a mock, because a mock proves the
 * call did not happen on the path the test took — not that the module cannot
 * reach a provider at all. The page promises no AI in the loop, so the write
 * path must be structurally incapable of calling one.
 */

const ROOT = process.cwd();

/** Modules that reach a provider, directly or through a wrapper. */
const LLM_MODULES = [
    'services/ai/directTransport',
    'services/ai/chat',
    'services/ai/jsonCompletion',
    'services/ai/agentLoop',
    'services/ai/ai',
    'services/memory/identityExtraction',
    'services/memory/sessionDigestBuild',
    'services/memory/memoryRollupBuild',
    'services/memory/memoryDream',
];

function resolveSpec(fromFile: string, spec: string): string | null {
    const base = spec.startsWith('@/')
        ? path.join(ROOT, spec.slice(2))
        : spec.startsWith('.')
            ? path.resolve(path.dirname(fromFile), spec)
            : null;
    if (!base) return null;
    for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
        if (fs.existsSync(candidate)) return candidate;
    }
    return null;
}

function importedModules(file: string): string[] {
    const source = fs.readFileSync(file, 'utf8');
    return [...source.matchAll(/from\s+'([^']+)'/g)]
        .map((m) => resolveSpec(file, m[1]!))
        .filter((f): f is string => f !== null);
}

describe('Explore write path cannot reach a model', () => {
    it('has no provider module anywhere in its import graph', () => {
        const entry = path.join(ROOT, 'services/memory/exploreNote.ts');
        const seen = new Set<string>();
        const queue = [entry];
        const offenders: string[] = [];

        while (queue.length > 0) {
            const file = queue.pop()!;
            if (seen.has(file)) continue;
            seen.add(file);
            const relative = path.relative(ROOT, file).replace(/\\/g, '/').replace(/\.tsx?$/, '');
            if (LLM_MODULES.includes(relative)) {
                offenders.push(relative);
                continue;
            }
            queue.push(...importedModules(file));
        }

        expect(seen.size).toBeGreaterThan(1);
        expect(offenders).toEqual([]);
    });
});
```

- [ ] **Step 6: Run the guard**

Run: `npx jest --runInBand __tests__/services/exploreNoteImports.test.ts`
Expected: PASS. If it fails, the offender names the module that must be removed from `exploreNote.ts`'s graph — do not widen `LLM_MODULES`.

- [ ] **Step 7: Commit**

```bash
git add services/memory/exploreNote.ts __tests__/services/exploreNote.test.ts \
        __tests__/services/exploreNoteImports.test.ts
git commit -m "feat(memory): saveExploreNote fans one note out to four stores, offline"
```

---

### Task 9: Note-inclusive themes + ledger display helpers

**Files:**
- Modify: `components/memory/memoryDisplay.ts:58-69`
- Test: `__tests__/components/memoryDisplay.test.ts` (extend)

**Interfaces:**
- Consumes: `extractTags` from `@/services/memory/keywordRanking`.
- Produces:
  ```ts
  export function themesForText(text: string): string[];
  export function formatLedgerDate(timestamp: number): { month: string; day: string; iso: string };
  export function originLabel(origin: NoteOrigin | undefined): string;
  ```

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/components/memoryDisplay.test.ts` (extend the import list):

```ts
    it('counts themes from notes too, so a user who only writes on Explore still sees them', () => {
        const atoms = [
            atom({ id: '1', layer: 'note', tags: ['mornings', 'calm'] }),
            atom({ id: '2', layer: 'note', tags: ['mornings'] }),
        ];
        expect(topMemoryThemes(atoms)).toEqual(['mornings', 'calm']);
    });

    it('formats a ledger date column', () => {
        const at = Date.UTC(2026, 8, 19, 10, 0, 0);
        const parts = formatLedgerDate(at);
        expect(parts.month).toMatch(/^[A-Z][a-z]{2}$/);
        expect(parts.day).toBe(String(new Date(at).getDate()));
        expect(parts.iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('labels provenance without pretending a Threads note came from chat', () => {
        expect(originLabel('threads')).toBe('Written on Threads');
        expect(originLabel('chat')).toBe('Journal');
        expect(originLabel(undefined)).toBe('Journal');
    });

    it('previews themes for composer text with the same matcher the write path uses', () => {
        expect(themesForText('Calm mornings help me think about mornings.'))
            .toEqual(['mornings', 'calm', 'help', 'think']);
        expect(themesForText('it was a day')).toEqual([]);
    });
```

Add `topMemoryThemes`, `formatLedgerDate`, `originLabel`, `themesForText` to the import from `'../../components/memory/memoryDisplay'`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest --runInBand __tests__/components/memoryDisplay.test.ts`
Expected: FAIL — `topMemoryThemes` returns `[]` for notes; the three new functions are not exported.

- [ ] **Step 3: Implement**

In `components/memory/memoryDisplay.ts`, replace `topMemoryThemes`:

```ts
/**
 * Every theme, notes included. The previous version filtered `layer !== 'note'`
 * out because notes were a side-channel that would have polluted a ranking of
 * extracted themes. Now that a note is a first-class memory the writer chose to
 * keep, excluding them meant a user who only writes on Explore saw no themes at
 * all — the portrait would describe an empty life to the person living it.
 */
export function topMemoryThemes(atoms: readonly LocalMemoryAtom[], limit = 6): string[] {
    const counts = new Map<string, number>();
    atoms
        .flatMap((atom) => atom.tags)
        .forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));

    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, limit)
        .map(([tag]) => tag);
}
```

Add the import and the three helpers at the end of the file:

```ts
import { extractTags } from '@/services/memory/keywordRanking';
import type { NoteOrigin } from '@/services/journal/journalStorage.types';
```

```ts
/**
 * Live "Filed under" preview. Same matcher the write path uses, so what the
 * composer shows is what the note is actually filed under — a second
 * implementation here would let the preview promise a theme the file never got.
 */
export function themesForText(text: string): string[] {
    return extractTags(text);
}

const LEDGER_MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Margin date column: month over day, plus the ISO key the row keys on. */
export function formatLedgerDate(timestamp: number): { month: string; day: string; iso: string } {
    const date = new Date(timestamp);
    const month = LEDGER_MONTHS[date.getMonth()] ?? '';
    return {
        month,
        day: String(date.getDate()),
        iso: getLocalDateKey(date),
    };
}

/**
 * Provenance label. `undefined` is `'chat'` — every entry saved before Explore
 * had a composer came from chat, so defaulting the other way would relabel
 * history.
 */
export function originLabel(origin: NoteOrigin | undefined): string {
    return origin === 'threads' ? 'Written on Threads' : 'Journal';
}
```

`getLocalDateKey` comes from `@/utils/date` — add it to the imports.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest --runInBand __tests__/components/memoryDisplay.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/memory/memoryDisplay.ts __tests__/components/memoryDisplay.test.ts
git commit -m "feat(memory): include notes in themes; add ledger display helpers"
```

---

### Task 10: `ExploreComposer`

Port the writing surface from `variant-a-index.html` (`.write` / `writeComposer` in `assets/parts.js:443`). Read the prototype first — the plan describes structure, the prototype is the visual source of truth.

**Files:**
- Create: `components/memory/ExploreComposer.tsx`
- Test: `__tests__/components/ExploreComposer.test.tsx`

**Interfaces:**
- Consumes: `formatLedgerDate`, `themesForText` (Task 9).
- Produces:
  ```ts
  interface ExploreComposerProps {
      value: string;
      onChangeText: (value: string) => void;
      onKeep: () => void;
      isSaving: boolean;
      /** Injected for tests; defaults to Date.now(). */
      now?: number;
  }
  ```

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/ExploreComposer.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ExploreComposer } from '../../components/memory/ExploreComposer';

jest.mock('../../hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));

const NOW = Date.UTC(2026, 8, 19, 10, 0, 0);

function setup(overrides: Partial<React.ComponentProps<typeof ExploreComposer>> = {}) {
    const props = {
        value: '',
        onChangeText: jest.fn(),
        onKeep: jest.fn(),
        isSaving: false,
        now: NOW,
        ...overrides,
    };
    render(<ExploreComposer {...props} />);
    return props;
}

describe('ExploreComposer', () => {
    it('offers Keep only once there is something to keep', () => {
        setup();
        expect(screen.getByLabelText('Keep this note').props.accessibilityState.disabled).toBe(true);
    });

    it('previews the themes the note will actually be filed under', () => {
        setup({ value: 'Calm mornings help me think about mornings.' });
        expect(screen.getByText(/Filed under/)).toBeTruthy();
        expect(screen.getByText(/mornings/)).toBeTruthy();
    });

    it('says so instead of inventing an observation when nothing is recognised', () => {
        setup({ value: 'it was a day' });
        expect(screen.getByText(/Nothing recognised/)).toBeTruthy();
    });

    it('never blocks keeping a note it could not file', () => {
        setup({ value: 'it was a day' });
        expect(screen.getByLabelText('Keep this note').props.accessibilityState.disabled).toBe(false);
    });

    it('calls onKeep when pressed', () => {
        const props = setup({ value: 'The kiln needs a new element.' });
        fireEvent.press(screen.getByLabelText('Keep this note'));
        expect(props.onKeep).toHaveBeenCalledTimes(1);
    });

    it('disables Keep while a save is in flight', () => {
        setup({ value: 'The kiln needs a new element.', isSaving: true });
        expect(screen.getByLabelText('Keep this note').props.accessibilityState.disabled).toBe(true);
    });

    it('offers no Refresh and no generated-suggestion action', () => {
        setup({ value: 'Calm mornings help.' });
        expect(screen.queryByText(/Refresh/)).toBeNull();
        expect(screen.queryByText(/Keep this as a note/)).toBeNull();
        expect(screen.queryByText(/Blackrose noticed/)).toBeNull();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --runInBand __tests__/components/ExploreComposer.test.tsx`
Expected: FAIL — `Cannot find module '../../components/memory/ExploreComposer'`.

- [ ] **Step 3: Implement the composer**

Create `components/memory/ExploreComposer.tsx`:

```tsx
import React, { useMemo } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { formatLedgerDate, themesForText } from './memoryDisplay';

interface ExploreComposerProps {
    value: string;
    onChangeText: (value: string) => void;
    onKeep: () => void;
    isSaving: boolean;
    /** Injected for tests; defaults to Date.now(). */
    now?: number;
}

/**
 * The page's primary action. Writing here is free-form journaling with no AI in
 * the loop: nothing is sent anywhere, and the only feedback is the date column
 * and the themes the note will be filed under — both derived locally.
 *
 * There is deliberately no Refresh and no "Keep this as a note": this *is* the
 * note, and there is nothing to recompute.
 */
export function ExploreComposer({ value, onChangeText, onKeep, isSaving, now }: ExploreComposerProps) {
    const isDark = useColorScheme() === 'dark';
    const placeholderColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const date = formatLedgerDate(now ?? Date.now());
    const themes = useMemo(() => themesForText(value), [value]);
    const hasText = value.trim().length > 0;
    const canKeep = hasText && !isSaving;

    return (
        <View className="flex-row gap-4">
            {/* Month over day, serif, in the margin — how a printed ledger dates
                a continuation. These are write dates, never event dates. */}
            <View className="w-11 items-end pt-1">
                <Text
                    className="text-[13px] uppercase tracking-[1px] text-text-secondary-light dark:text-text-secondary-dark"
                >
                    {date.month}
                </Text>
                <Text
                    className="text-[22px] leading-7 text-text-light dark:text-text-dark"
                    style={{ fontFamily: 'PlayfairDisplayRegular' }}
                >
                    {date.day}
                </Text>
            </View>

            <View className="min-w-0 flex-1 gap-3">
                <Text className="text-[11px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark">
                    New line
                </Text>
                <TextInput
                    value={value}
                    onChangeText={onChangeText}
                    placeholder="Write it plainly. No one is reading it."
                    placeholderTextColor={placeholderColor}
                    multiline
                    textAlignVertical="top"
                    className="min-h-[84px] text-[16px] leading-6 text-text-light dark:text-text-dark"
                    accessibilityLabel="New note"
                />

                {hasText ? (
                    <View className="gap-1 border-t border-hairline-light pt-3 dark:border-hairline-dark">
                        <Text className="text-[11px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark">
                            Filed under
                        </Text>
                        <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                            {themes.length > 0
                                ? themes.slice(0, 4).join(' · ')
                                : 'Nothing recognised — it will be kept as written'}
                        </Text>
                    </View>
                ) : null}

                <View className="flex-row justify-end">
                    <Pressable
                        onPress={onKeep}
                        disabled={!canKeep}
                        accessibilityRole="button"
                        accessibilityLabel="Keep this note"
                        accessibilityState={{ disabled: !canKeep }}
                        className="rounded-control border border-hairline-light px-4 py-2 dark:border-hairline-dark"
                        style={({ pressed }) => [{ opacity: !canKeep ? 0.4 : pressed ? 0.7 : 1 }]}
                    >
                        <Text className="text-sm text-text-light dark:text-text-dark">
                            {isSaving ? 'Keeping…' : 'Keep'}
                        </Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest --runInBand __tests__/components/ExploreComposer.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add components/memory/ExploreComposer.tsx __tests__/components/ExploreComposer.test.tsx
git commit -m "feat(memory): add the Explore writing surface"
```

---

### Task 11: `MemoryLedgerRow` replaces `MemoryAtomCard`

**Files:**
- Create: `components/memory/MemoryLedgerRow.tsx`
- Delete: `components/memory/MemoryAtomCard.tsx`, `__tests__/components/MemoryAtomCard.test.tsx`
- Test: `__tests__/components/MemoryLedgerRow.test.tsx`

**Interfaces:**
- Consumes: `formatLedgerDate`, `MEMORY_LAYER_LABELS`, `memoryAtomRoute`, `formatRelativeMemoryTime` (Task 9 / existing).
- Produces:
  ```ts
  interface MemoryLedgerRowProps {
      atom: LocalMemoryAtom;
      onDelete: (atom: LocalMemoryAtom) => void;
      onThemePress: (tag: string) => void;
      onOpen?: (atom: LocalMemoryAtom) => void;
      /** False when the row above already printed this month. */
      showMonth: boolean;
  }
  ```

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/MemoryLedgerRow.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { MemoryLedgerRow } from '../../components/memory/MemoryLedgerRow';
import type { LocalMemoryAtom } from '../../services/memory/localMemory.types';

jest.mock('../../hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: ({ name }: { name: string }) => {
        const React = jest.requireActual('react');
        const { Text } = jest.requireActual('react-native');
        return <Text>{name}</Text>;
    },
}));

const atom: LocalMemoryAtom = {
    id: 'note-1',
    layer: 'note',
    source: 'manual',
    sourceId: 'entry_1',
    rootSourceId: 'entry_1',
    rootSourceKind: 'journal_entry',
    title: 'Calm mornings help',
    content: 'Calm mornings help me think straight about the work.',
    tags: ['mornings', 'calm'],
    salience: 0.9,
    confidence: 1,
    createdAt: Date.UTC(2026, 8, 19, 10, 0, 0),
    updatedAt: Date.UTC(2026, 8, 19, 10, 0, 0),
    accessCount: 3,
};

function setup(overrides: Partial<React.ComponentProps<typeof MemoryLedgerRow>> = {}) {
    const props = {
        atom,
        onDelete: jest.fn(),
        onThemePress: jest.fn(),
        onOpen: jest.fn(),
        showMonth: true,
        ...overrides,
    };
    render(<MemoryLedgerRow {...props} />);
    return props;
}

describe('MemoryLedgerRow', () => {
    it('shows the claim and the evidence as different lines', () => {
        setup();
        expect(screen.getByText('Calm mornings help')).toBeTruthy();
        expect(screen.getByText(atom.content)).toBeTruthy();
    });

    it('prints the month only on the first row of a day', () => {
        const { unmount } = render(
            <MemoryLedgerRow atom={atom} onDelete={jest.fn()} onThemePress={jest.fn()} showMonth={false} />,
        );
        expect(screen.queryByText('Sep')).toBeNull();
        unmount();
    });

    it('opens the entry the note came from', () => {
        const props = setup();
        fireEvent.press(screen.getByLabelText('Open memory Calm mornings help'));
        expect(props.onOpen).toHaveBeenCalledWith(atom);
    });

    it('exposes tag filtering and delete', () => {
        const props = setup();
        fireEvent.press(screen.getByLabelText('Filter memory by mornings'));
        expect(props.onThemePress).toHaveBeenCalledWith('mornings');
        fireEvent.press(screen.getByLabelText('Delete memory Calm mornings help'));
        expect(props.onDelete).toHaveBeenCalledWith(atom);
    });

    it('shows recurrence and provenance rather than raw score bookkeeping', () => {
        setup();
        expect(screen.getByText(/Notes/)).toBeTruthy();
        expect(screen.getByText(/3 revisits/)).toBeTruthy();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --runInBand __tests__/components/MemoryLedgerRow.test.tsx`
Expected: FAIL — `Cannot find module '../../components/memory/MemoryLedgerRow'`.

- [ ] **Step 3: Implement the row**

Create `components/memory/MemoryLedgerRow.tsx`:

```tsx
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { BLACKROSE_PALETTE, MemoryLayerColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { LocalMemoryAtom } from '@/services/memory/localMemory.types';
import {
    formatLedgerDate,
    formatRelativeMemoryTime,
    MEMORY_LAYER_LABELS,
    memoryAtomRoute,
} from './memoryDisplay';

interface MemoryLedgerRowProps {
    atom: LocalMemoryAtom;
    onDelete: (atom: LocalMemoryAtom) => void;
    onThemePress: (tag: string) => void;
    onOpen?: (atom: LocalMemoryAtom) => void;
    /** False when the row above already printed this month. */
    showMonth: boolean;
}

/**
 * One memory as a ledger row: a serif date in the margin, then the claim and the
 * evidence as two different lines. The old card put the title and the body in
 * identical type, so a row spent two lines saying one thing.
 *
 * The date is the *write* date and the list head says "Written" for that reason
 * (clock doctrine — an entry's weekday lives in its prose, never in its
 * timestamp).
 */
export function MemoryLedgerRow({
    atom,
    onDelete,
    onThemePress,
    onOpen,
    showMonth,
}: MemoryLedgerRowProps) {
    const isDark = useColorScheme() === 'dark';
    const inkColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const layerColor = MemoryLayerColors[atom.layer];
    const date = formatLedgerDate(atom.createdAt);
    const tags = atom.tags.slice(0, 3);
    const route = memoryAtomRoute(atom);
    const canOpen = Boolean(route && onOpen);

    const handlePress = () => {
        if (!canOpen || !onOpen) return;
        if (Platform.OS !== 'web') {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onOpen(atom);
    };

    return (
        <Pressable
            onPress={canOpen ? handlePress : undefined}
            disabled={!canOpen}
            accessibilityRole={canOpen ? 'button' : undefined}
            accessibilityLabel={canOpen ? `Open memory ${atom.title}` : atom.title}
            className="flex-row gap-4 py-4"
            style={({ pressed }) => [{ opacity: pressed && canOpen ? 0.92 : 1 }]}
        >
            <View className="w-11 items-end">
                <Text className="text-[13px] uppercase tracking-[1px] text-text-secondary-light dark:text-text-secondary-dark">
                    {showMonth ? date.month : ''}
                </Text>
                <Text
                    className="text-[20px] leading-6 text-text-light dark:text-text-dark"
                    style={{ fontFamily: 'PlayfairDisplayRegular' }}
                >
                    {date.day}
                </Text>
            </View>

            <View className="min-w-0 flex-1 gap-2">
                <View className="flex-row items-start justify-between gap-3">
                    <Text
                        className="min-w-0 flex-1 text-[18px] leading-6 text-text-light dark:text-text-dark"
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                        numberOfLines={2}
                    >
                        {atom.title}
                    </Text>
                    <Pressable
                        onPress={() => onDelete(atom)}
                        className="h-8 w-8 items-center justify-center"
                        accessibilityRole="button"
                        accessibilityLabel={`Delete memory ${atom.title}`}
                        hitSlop={6}
                    >
                        <MaterialIcons name="more-vert" size={18} color={inkColor} />
                    </Pressable>
                </View>

                <Text
                    className="text-sm leading-5 text-text-secondary-light dark:text-text-secondary-dark"
                    numberOfLines={3}
                >
                    {atom.content}
                </Text>

                <View className="flex-row items-center gap-2">
                    <View
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: layerColor }}
                        accessibilityLabel={`${MEMORY_LAYER_LABELS[atom.layer]} memory marker`}
                    />
                    <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                        {MEMORY_LAYER_LABELS[atom.layer]}
                    </Text>
                    <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                        · {formatRelativeMemoryTime(atom.updatedAt || atom.createdAt)}
                    </Text>
                    {atom.accessCount > 0 ? (
                        <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                            · {atom.accessCount} revisits
                        </Text>
                    ) : null}
                </View>

                {tags.length > 0 ? (
                    <View className="flex-row flex-wrap gap-3">
                        {tags.map((tag) => (
                            <Pressable
                                key={tag}
                                onPress={() => onThemePress(tag)}
                                accessibilityRole="button"
                                accessibilityLabel={`Filter memory by ${tag}`}
                                hitSlop={4}
                            >
                                <Text className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                                    {tag}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                ) : null}
            </View>
        </Pressable>
    );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest --runInBand __tests__/components/MemoryLedgerRow.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Delete the replaced card**

```bash
git rm components/memory/MemoryAtomCard.tsx __tests__/components/MemoryAtomCard.test.tsx
```

Then remove `MemoryAtomCard` from `components/memory/index.ts` and confirm no other importer remains:

Run: `grep -rn "MemoryAtomCard" app/ components/ hooks/ __tests__/`
Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add -A components/memory/MemoryLedgerRow.tsx components/memory/index.ts \
           __tests__/components/MemoryLedgerRow.test.tsx
git commit -m "feat(memory): replace the atom card with a ledger row"
```

---

### Task 12: `ThemeDriftStrip`

The prototype drove `scrollLeft` because a CSS transform and native scroll cannot both own the offset. RN maps that to an `Animated.ScrollView` whose position is driven from a Reanimated frame callback. Read `variant-a-index.html`'s `frame()` / `onDragMove()` / `endDrag()` and the motion notes in `assets/explore.css` before writing this.

**Files:**
- Create: `components/memory/ThemeDriftStrip.tsx`
- Test: `__tests__/components/ThemeDriftStrip.test.tsx`

**Interfaces:**
- Consumes: `useReducedMotion` (`react-native-reanimated`), `scrollTo`/`useAnimatedRef`/`useFrameCallback`/`useSharedValue`.
- Produces:
  ```ts
  interface ThemeDriftStripProps {
      themes: readonly string[];
      onThemePress: (theme: string) => void;
  }
  ```

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/ThemeDriftStrip.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeDriftStrip } from '../../components/memory/ThemeDriftStrip';

jest.mock('../../hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));

const THEMES = ['mornings', 'calm', 'work'];

describe('ThemeDriftStrip', () => {
    it('renders one focusable run and inert repeats', () => {
        render(<ThemeDriftStrip themes={THEMES} onThemePress={jest.fn()} />);
        // One button per theme — the repeats exist to make the offset periodic,
        // and a focusable element inside a duplicated run is a focus trap.
        expect(screen.getAllByRole('button')).toHaveLength(THEMES.length);
    });

    it('filters by theme when a word is pressed', () => {
        const onThemePress = jest.fn();
        render(<ThemeDriftStrip themes={THEMES} onThemePress={onThemePress} />);
        fireEvent.press(screen.getAllByLabelText('Filter memory by calm')[0]!);
        expect(onThemePress).toHaveBeenCalledWith('calm');
    });

    it('labels the group for assistive tech', () => {
        render(<ThemeDriftStrip themes={THEMES} onThemePress={jest.fn()} />);
        expect(screen.getByLabelText('Themes you return to')).toBeTruthy();
    });

    it('renders nothing when there are no themes', () => {
        const { toJSON } = render(<ThemeDriftStrip themes={[]} onThemePress={jest.fn()} />);
        expect(toJSON()).toBeNull();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --runInBand __tests__/components/ThemeDriftStrip.test.tsx`
Expected: FAIL — `Cannot find module '../../components/memory/ThemeDriftStrip'`.

- [ ] **Step 3: Implement the strip**

Create `components/memory/ThemeDriftStrip.tsx`:

```tsx
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
    scrollTo,
    useAnimatedRef,
    useFrameCallback,
    useReducedMotion,
    useSharedValue,
} from 'react-native-reanimated';

/** Pixels per second the strip drifts. Slow enough to read, fast enough to notice. */
const DRIFT_SPEED = 14;
/** Identical runs. Enough that a normal drag never reaches the content edge. */
const RUN_COUNT = 6;

interface ThemeDriftStripProps {
    themes: readonly string[];
    onThemePress: (theme: string) => void;
}

/**
 * Themes that drift slowly past the reader. The page's only looping motion.
 *
 * A CSS transform and native scroll cannot both own the offset, so the prototype
 * drove `scrollLeft` directly; here a frame callback drives `scrollTo` on an
 * `Animated.ScrollView`. Native scroll still owns the position while a finger is
 * down, and the offset is re-adopted from `contentOffset.x` when momentum ends —
 * so flick and momentum behave natively instead of being reimplemented.
 *
 * The wrap is seamless because the content is periodic: normalising the offset
 * modulo one run's width lands on identical pixels, so the correction is
 * invisible.
 *
 * **Only the first run is interactive.** Duplicated runs exist to make the offset
 * periodic; buttons inside them would put focusable content inside `aria-hidden`
 * and make tabbing walk the same words over and over.
 */
export function ThemeDriftStrip({ themes, onThemePress }: ThemeDriftStripProps) {
    const reduceMotion = useReducedMotion();
    const scrollRef = useAnimatedRef<Animated.ScrollView>();
    const offset = useSharedValue(0);
    const paused = useSharedValue(false);
    const runWidth = useSharedValue(0);

    useFrameCallback((frame) => {
        'worklet';
        if (paused.value || reduceMotion || runWidth.value <= 0) return;
        const elapsed = frame.timeSincePreviousFrame ?? 0;
        offset.value = (offset.value + (DRIFT_SPEED * elapsed) / 1000) % runWidth.value;
        scrollTo(scrollRef, offset.value, 0, false);
    }, true);

    if (themes.length === 0) return null;

    return (
        <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Themes you return to"
        >
            <Animated.ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onScrollBeginDrag={() => {
                    paused.value = true;
                }}
                onMomentumScrollEnd={(event) => {
                    // Adopt where native scroll landed, normalised so the offset
                    // stays inside one run. Identical runs make that invisible.
                    const x = event.nativeEvent.contentOffset.x;
                    offset.value = runWidth.value > 0 ? x % runWidth.value : x;
                    paused.value = false;
                }}
                onScrollEndDrag={(event) => {
                    // A drag with no momentum ends here instead; momentum end
                    // fires afterwards only when there is momentum to spend.
                    const x = event.nativeEvent.contentOffset.x;
                    offset.value = runWidth.value > 0 ? x % runWidth.value : x;
                    paused.value = false;
                }}
            >
                {Array.from({ length: RUN_COUNT }, (_, run) => (
                    <View
                        key={run}
                        className="flex-row items-center gap-5 pr-5"
                        onLayout={run === 0
                            ? (event) => {
                                runWidth.value = event.nativeEvent.layout.width;
                            }
                            : undefined}
                        accessibilityElementsHidden={run > 0}
                        importantForAccessibility={run > 0 ? 'no-hide-descendants' : 'auto'}
                    >
                        {themes.map((theme) => (run === 0 ? (
                            <Pressable
                                key={theme}
                                onPress={() => onThemePress(theme)}
                                accessibilityRole="button"
                                accessibilityLabel={`Filter memory by ${theme}`}
                                hitSlop={6}
                            >
                                <Text
                                    className="text-[15px] text-text-light dark:text-text-dark"
                                    style={{ fontFamily: 'PlayfairDisplayRegular' }}
                                >
                                    {theme}
                                </Text>
                            </Pressable>
                        ) : (
                            <Text
                                key={theme}
                                className="text-[15px] text-text-light dark:text-text-dark"
                                style={{ fontFamily: 'PlayfairDisplayRegular' }}
                            >
                                {theme}
                            </Text>
                        )))}
                    </View>
                ))}
            </Animated.ScrollView>
        </View>
    );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest --runInBand __tests__/components/ThemeDriftStrip.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Verify motion in a real browser (required — Jest cannot observe it)**

Jest's Reanimated mock cannot see motion, so this step is not optional.

```bash
npx expo start --web --port 8081
```

Open `http://localhost:8081/explore` and confirm, recording what you observe:

1. The strip drifts continuously and slowly.
2. The seam is invisible — the same word does not visibly jump as the offset wraps.
3. A drag pauses the drift and follows the finger.
4. After release the drift resumes from where the finger left it, with no snap-back.
5. With OS reduced-motion on, the strip does not drift but still scrolls by drag.

Then compare against the prototype at `example-design/blackrose/explore-variants/variant-a-index.html`.

**If the offset visibly fights native scroll** (jitter, snap-back, or the drift stalling after a drag), fall back to the documented alternative: drop `Animated.ScrollView` and drive a doubled row's `translateX` from a `Pan` gesture, keeping the same periodic-content wrap and the same reduced-motion gate. Record the fallback in the task notes with what you saw.

- [ ] **Step 6: Commit**

```bash
git add components/memory/ThemeDriftStrip.tsx __tests__/components/ThemeDriftStrip.test.tsx
git commit -m "feat(memory): add the drifting theme strip"
```

---

### Task 13: `useLocalMemories` — add the Explore write, drop the generated note

**Files:**
- Modify: `hooks/memory/useLocalMemories.ts`
- Test: `__tests__/hooks/useLocalMemories.test.tsx`

**Interfaces:**
- Consumes: `saveExploreNote` (Task 8).
- Produces:
  ```ts
  interface UseLocalMemoriesReturn {
      atoms: LocalMemoryAtom[];
      isLoading: boolean;
      refresh: () => Promise<void>;
      addExploreNote: (text: string) => Promise<ExploreNoteResult>;
      removeAtom: (id: string) => Promise<void>;
      clearAll: () => Promise<void>;
  }
  ```
  (`generatedNote`, `addGeneratedNote`, `refreshGeneratedNote` are gone.)

- [ ] **Step 1: Rewrite the test**

Replace `__tests__/hooks/useLocalMemories.test.tsx` with:

```tsx
/* eslint-disable import/first */

import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('../../services/memory/localMemory', () => ({
    clearMemoryAtoms: jest.fn(),
    deleteMemoryAtom: jest.fn(),
    listMemoryAtoms: jest.fn(),
    subscribeMemoryChanges: jest.fn(() => () => undefined),
}));

jest.mock('../../services/memory/exploreNote', () => ({
    saveExploreNote: jest.fn(),
}));

import { clearMemoryAtoms, deleteMemoryAtom, listMemoryAtoms } from '../../services/memory/localMemory';
import { saveExploreNote } from '../../services/memory/exploreNote';
import { useLocalMemories } from '../../hooks/memory/useLocalMemories';

const mockClearMemoryAtoms = jest.mocked(clearMemoryAtoms);
const mockDeleteMemoryAtom = jest.mocked(deleteMemoryAtom);
const mockListMemoryAtoms = jest.mocked(listMemoryAtoms);
const mockSaveExploreNote = jest.mocked(saveExploreNote);

describe('useLocalMemories', () => {
    beforeEach(() => {
        mockListMemoryAtoms.mockResolvedValue([]);
        mockClearMemoryAtoms.mockResolvedValue(undefined);
        mockDeleteMemoryAtom.mockResolvedValue(true);
        mockSaveExploreNote.mockResolvedValue({
            entry: { id: 'entry_1' },
            atom: null,
            file: null,
            failures: [],
            themes: ['calm'],
        } as never);
    });

    afterEach(() => jest.clearAllMocks());

    it('loads memories', async () => {
        const { result } = renderHook(() => useLocalMemories());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(mockListMemoryAtoms).toHaveBeenCalledTimes(1);
    });

    it('keeps an Explore note through the shared write path and refreshes', async () => {
        const { result } = renderHook(() => useLocalMemories());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await result.current.addExploreNote('Calm mornings help.');
        });

        expect(mockSaveExploreNote).toHaveBeenCalledWith({ text: 'Calm mornings help.' });
        expect(mockListMemoryAtoms).toHaveBeenCalledTimes(2);
    });

    it('does not call the write path for blank text', async () => {
        const { result } = renderHook(() => useLocalMemories());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await result.current.addExploreNote('   ');
        });

        expect(mockSaveExploreNote).not.toHaveBeenCalled();
    });

    it('surfaces partial-write failures to the caller', async () => {
        mockSaveExploreNote.mockResolvedValue({
            entry: { id: 'entry_1' },
            atom: null,
            file: null,
            failures: [{ store: 'file', message: 'disk full' }],
            themes: [],
        } as never);
        const { result } = renderHook(() => useLocalMemories());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        let outcome: { failures: unknown[] } | null = null;
        await act(async () => {
            outcome = await result.current.addExploreNote('The kiln needs an element.');
        });

        expect(outcome?.failures).toHaveLength(1);
    });

    it('clears local memories and refreshes', async () => {
        const { result } = renderHook(() => useLocalMemories());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        await act(async () => {
            await result.current.clearAll();
        });
        expect(mockClearMemoryAtoms).toHaveBeenCalledTimes(1);
    });

    it('deletes a local memory atom and refreshes', async () => {
        const { result } = renderHook(() => useLocalMemories());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        await act(async () => {
            await result.current.removeAtom('atom-1');
        });
        expect(mockDeleteMemoryAtom).toHaveBeenCalledWith('atom-1');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --runInBand __tests__/hooks/useLocalMemories.test.tsx`
Expected: FAIL — `result.current.addExploreNote is not a function`.

- [ ] **Step 3: Rewrite the hook**

Replace `hooks/memory/useLocalMemories.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    clearMemoryAtoms,
    deleteMemoryAtom,
    listMemoryAtoms,
    subscribeMemoryChanges,
} from '@/services/memory/localMemory';
import { saveExploreNote } from '@/services/memory/exploreNote';
import type { ExploreNoteResult } from '@/services/memory/exploreNote';
import type { LocalMemoryAtom } from '@/services/memory/localMemory.types';

interface UseLocalMemoriesReturn {
    atoms: LocalMemoryAtom[];
    isLoading: boolean;
    refresh: () => Promise<void>;
    /** Keeps a note on Explore. Returns the outcome so the screen can report a partial write. */
    addExploreNote: (text: string) => Promise<ExploreNoteResult | null>;
    removeAtom: (id: string) => Promise<void>;
    clearAll: () => Promise<void>;
}

/**
 * Explore's view of local memory. The write goes through `saveExploreNote`, not
 * a bespoke atom write: the note must reach the memory-file store too, or
 * `memory_search` cannot see it.
 */
export function useLocalMemories(): UseLocalMemoriesReturn {
    const [atoms, setAtoms] = useState<LocalMemoryAtom[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const hasLoadedRef = useRef(false);

    const refresh = useCallback(async () => {
        // Full-page spinner only on first load — keep the list mounted after that.
        if (!hasLoadedRef.current) setIsLoading(true);
        try {
            setAtoms(await listMemoryAtoms());
            hasLoadedRef.current = true;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const addExploreNote = useCallback(async (text: string) => {
        if (!text.trim()) return null;
        const result = await saveExploreNote({ text });
        await refresh();
        return result;
    }, [refresh]);

    const removeAtom = useCallback(async (id: string) => {
        await deleteMemoryAtom(id);
        await refresh();
    }, [refresh]);

    const clearAll = useCallback(async () => {
        await clearMemoryAtoms();
        await refresh();
    }, [refresh]);

    useEffect(() => {
        refresh().catch(() => setIsLoading(false));
        return subscribeMemoryChanges(() => {
            refresh().catch(() => setIsLoading(false));
        });
    }, [refresh]);

    return { atoms, isLoading, refresh, addExploreNote, removeAtom, clearAll };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest --runInBand __tests__/hooks/useLocalMemories.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add hooks/memory/useLocalMemories.ts __tests__/hooks/useLocalMemories.test.tsx
git commit -m "feat(memory): route the Explore write through saveExploreNote"
```

---

### Task 14: The hub port — screen, portrait, empty, skeleton, deletions

Read `example-design/blackrose/explore-variants/variant-a-index.html` first. Structure in order: page head (Memory / "What Blackrose holds for you") → hairline rule → **composer** → portrait (About you + drifting theme strip) → filter line → search rule → "Written" list head → dated entry rows.

**Files:**
- Modify: `components/memory/MemoryHubScreen.tsx`, `MemoryPortrait.tsx`, `MemoryEmpty.tsx`, `MemoryHubSkeleton.tsx`, `index.ts`
- Delete: `components/memory/MemoryNotesPanel.tsx`
- Test: `__tests__/components/MemoryHubScreen.test.tsx`

**Interfaces:**
- Consumes: `ExploreComposer`, `MemoryLedgerRow`, `ThemeDriftStrip`, `useLocalMemories().addExploreNote`.
- Produces: `MEMORY_ATOMS_PAGE_SIZE` must stay exported (pinned by `__tests__/components/today/memoryPagination.test.ts`).

- [ ] **Step 1: Write the failing test**

Create `__tests__/components/MemoryHubScreen.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { MemoryHubScreen } from '../../components/memory/MemoryHubScreen';

jest.mock('../../hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('../../hooks/navigation/useTabNavigation', () => ({
    useTabNavigation: () => ({ goToTab: jest.fn() }),
}));
jest.mock('../../components/journal', () => ({ BottomNav: () => null }));
jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: ({ name }: { name: string }) => {
        const React = jest.requireActual('react');
        const { Text } = jest.requireActual('react-native');
        return <Text>{name}</Text>;
    },
}));

const addExploreNote = jest.fn().mockResolvedValue({ failures: [], themes: [] });
jest.mock('../../hooks/memory/useLocalMemories', () => ({
    useLocalMemories: () => ({
        atoms: [],
        isLoading: false,
        refresh: jest.fn(),
        addExploreNote,
        removeAtom: jest.fn(),
        clearAll: jest.fn(),
    }),
}));

describe('MemoryHubScreen', () => {
    it('leads with the composer', () => {
        render(<MemoryHubScreen />);
        expect(screen.getByLabelText('New note')).toBeTruthy();
    });

    it('keeps a note through the shared write path and clears the input', async () => {
        render(<MemoryHubScreen />);
        fireEvent.changeText(screen.getByLabelText('New note'), 'Calm mornings help.');
        fireEvent.press(screen.getByLabelText('Keep this note'));

        await waitFor(() => expect(addExploreNote).toHaveBeenCalledWith('Calm mornings help.'));
        await waitFor(() => expect(screen.getByLabelText('New note').props.value).toBe(''));
    });

    it('keeps the graph affordance the dark-mode guard asserts on', () => {
        render(<MemoryHubScreen />);
        expect(screen.getByText('Open graph')).toBeTruthy();
    });

    it('shows no fake AI panel', () => {
        render(<MemoryHubScreen />);
        expect(screen.queryByText(/Blackrose noticed/)).toBeNull();
        expect(screen.queryByText(/Keep this as a note/)).toBeNull();
        expect(screen.queryByText(/Refresh/)).toBeNull();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --runInBand __tests__/components/MemoryHubScreen.test.tsx`
Expected: FAIL — no `New note` label; the old screen renders the Notes panel instead.

- [ ] **Step 3: Rebuild the portrait**

Replace `components/memory/MemoryPortrait.tsx`'s theme chips block with the drift strip, keeping the label, prose and meta exactly as they are. Change the import of `topMemoryThemes` usage to stay `topMemoryThemes(atoms, 4)` (now note-inclusive), replace the `flex-row flex-wrap gap-2` chips `View` with:

```tsx
            {themes.length > 0 ? (
                <ThemeDriftStrip themes={themes} onThemePress={onThemePress} />
            ) : null}
```

Add `import { ThemeDriftStrip } from './ThemeDriftStrip';` and drop the now-unused `titleCase` helper and the `Pressable` import if nothing else uses them.

- [ ] **Step 4: Rebuild the empty and skeleton states to the new layout**

`components/memory/MemoryEmpty.tsx` — change the message to name the composer, and the button to focus it rather than route to chat:

```tsx
interface MemoryEmptyProps {
    onWritePress: () => void;
}
```
Keep the signature (the screen passes a focus handler). Update the copy:

```tsx
            <Text className="max-w-xs text-center text-sm leading-relaxed text-text-secondary-light dark:text-text-secondary-dark">
                Nothing is kept yet. Write a line above and it stays — here and in your archive.
            </Text>
```
and the button label to `Write a line`.

`components/memory/MemoryHubSkeleton.tsx` — replace the card blocks with a composer-shaped block (a date column plus four text lines) and four ledger rows, keeping `LoadingStatus`:

```tsx
export function MemoryHubSkeleton() {
    return (
        <View className="gap-6 py-4" accessibilityLabel="Loading memory">
            <LoadingStatus label="Gathering your memories" compact />
            <View className="flex-row gap-4">
                <Skeleton className="h-10 w-11" accessibilityLabel="Loading composer date" />
                <View className="flex-1 gap-3">
                    <Skeleton className="h-4 w-20" accessibilityLabel="Loading composer label" />
                    <Skeleton className="h-20 w-full" accessibilityLabel="Loading composer input" />
                </View>
            </View>
            <View className="gap-5">
                {[1, 2, 3, 4].map((index) => (
                    <View key={index} className="flex-row gap-4">
                        <Skeleton className="h-8 w-11" accessibilityLabel={`Loading memory date ${index}`} />
                        <View className="flex-1 gap-2">
                            <Skeleton className="h-5 w-40" accessibilityLabel={`Loading memory title ${index}`} />
                            <Skeleton className="h-3 w-3/4" accessibilityLabel={`Loading memory summary ${index}`} />
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}
```

- [ ] **Step 5: Rebuild the screen**

Rewrite `components/memory/MemoryHubScreen.tsx`. Keep `MEMORY_ATOMS_PAGE_SIZE`, the `LayerFilters` sub-component, `handleOpenGraph`, `handleOpenAtom`, `deleteAtom`, `clearAll`, the header with the overflow menu, and the `BottomNav`. Keep the "Open graph" `Pressable` **with its exact className string** — `__tests__/dark-mode-contrast.test.ts:104-107` asserts `"Open graph"`, `"border-hairline-light"`, and `"text-text-light underline dark:text-text-dark"` inside this file.

The new body, in order:

```tsx
                <RevealItem scrollY={scrollY}>
                    <View className="mb-6 flex-row items-start justify-between gap-4 border-b border-hairline-light pb-5 dark:border-hairline-dark">
                        {/* page head — unchanged from the current file */}
                    </View>
                </RevealItem>

                <RevealItem scrollY={scrollY}>
                    <View className="pb-6">
                        <ExploreComposer
                            value={noteText}
                            onChangeText={setNoteText}
                            onKeep={keepNote}
                            isSaving={isSaving}
                        />
                    </View>
                </RevealItem>

                <RevealItem scrollY={scrollY}>
                    <MemoryPortrait atoms={memory.atoms} onThemePress={setQuery} />
                </RevealItem>

                <RevealItem scrollY={scrollY}>
                    <View className="gap-4 pt-6">
                        <LayerFilters activeLayer={activeLayer} atoms={memory.atoms} onLayerPress={setActiveLayer} />
                        {/* search rule — unchanged */}
                        <Text
                            className="pt-2 text-[11px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark"
                        >
                            Written
                        </Text>
                        {filteredAtoms.length > 0 ? (
                            <View>
                                {visibleAtoms.map((atom, index) => (
                                    <MemoryLedgerRow
                                        key={atom.id}
                                        atom={atom}
                                        showMonth={index === 0
                                            || formatLedgerDate(visibleAtoms[index - 1]!.createdAt).month
                                                !== formatLedgerDate(atom.createdAt).month}
                                        onDelete={deleteAtom}
                                        onThemePress={setQuery}
                                        onOpen={handleOpenAtom}
                                    />
                                ))}
                                {/* Show more — unchanged */}
                            </View>
                        ) : (
                            <Text className="py-6 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                                Nothing written under this filter yet.
                            </Text>
                        )}
                        <Pressable onPress={handleOpenGraph} /* unchanged props */ >
                            <Text className="text-[17px] text-text-light underline dark:text-text-dark"
                                style={{ fontFamily: 'PlayfairDisplayRegular' }}>
                                Open graph
                            </Text>
                        </Pressable>
                    </View>
                </RevealItem>
```

Add the keep handler:

```tsx
    const [isSaving, setIsSaving] = useState(false);

    const keepNote = async () => {
        if (!noteText.trim() || isSaving) return;
        setIsSaving(true);
        try {
            const result = await memory.addExploreNote(noteText);
            setNoteText('');
            if (result && result.failures.length > 0) {
                // The words are saved; only derived memory is incomplete. Say which.
                Alert.alert(
                    'Saved, with a gap',
                    `Your note is in your archive. ${result.failures.map((f) => f.store).join(', ')} did not finish saving.`,
                );
            }
        } catch (error) {
            Alert.alert('Could not keep the note', errorMessage(error));
        } finally {
            setIsSaving(false);
        }
    };
```

Remove the `MemoryNotesPanel` import and the `noteText`/`generatedNote` wiring for it, the `saveNote` and `saveGeneratedNote` handlers, and the `sourceThemes` memo.

- [ ] **Step 6: Delete the panel and update the barrel**

```bash
git rm components/memory/MemoryNotesPanel.tsx
```

Rewrite `components/memory/index.ts`:

```ts
export { MemoryHubScreen, MEMORY_ATOMS_PAGE_SIZE } from './MemoryHubScreen';
export { MemoryPortrait } from './MemoryPortrait';
export { MemoryLedgerRow } from './MemoryLedgerRow';
export { ExploreComposer } from './ExploreComposer';
export { ThemeDriftStrip } from './ThemeDriftStrip';
export { MemoryEmpty } from './MemoryEmpty';
```

- [ ] **Step 7: Remove the deleted generators from `localMemory.ts`**

Delete `generateMemoryNoteSuggestion` (line 611-627), `saveGeneratedMemoryNote` (585-598), and `topAtoms` (600-605). Delete the now-orphaned `collectThemes` (607-609) if nothing else calls it — verify with `grep -rn "collectThemes\|topAtoms\|saveGeneratedMemoryNote\|generateMemoryNoteSuggestion" services/ hooks/ components/ app/ __tests__/`.

Also delete the two tests in `__tests__/services/localMemory.test.ts` that pin them:

- `'generates a warm therapist-voice suggested note from non-note memory atoms'` (the one asserting `"Rosebud notices you often return to themes of"`) — this is spec success criterion 5.
- `'saves generated settings notes as system note atoms'`

and remove `generateMemoryNoteSuggestion` / `saveGeneratedMemoryNote` from that file's import list.

Note on `topAtoms`: deleting the panel removes the only place notes were excluded from ranking, so no ranking change is needed — the exclusion disappears with its caller.

- [ ] **Step 8: Run the tests**

Run: `npx jest --runInBand __tests__/components/MemoryHubScreen.test.tsx __tests__/services/localMemory.test.ts __tests__/components/today/memoryPagination.test.ts __tests__/dark-mode-contrast.test.ts __tests__/components/memoryDisplay.test.ts`
Expected: PASS.

- [ ] **Step 9: Check the design limit**

Run: `npm run check:design`
Expected: no new errors. If `MemoryHubScreen.tsx` approaches 450 lines, extract `LayerFilters` into its own file under `components/memory/`.

- [ ] **Step 10: Commit**

```bash
git add -A components/memory hooks/memory services/memory/localMemory.ts \
           __tests__/components/MemoryHubScreen.test.tsx __tests__/services/localMemory.test.ts
git commit -m "feat(explore): port the ledger screen and delete the fake AI panel"
```

---

### Task 15: Archive provenance label

**Files:**
- Modify: `hooks/history/historyUtils.ts:8-18`, `:155-185`, `components/history/HistoryEntryCard.tsx:19-27`
- Modify: `app/entry-detail.tsx` (the authored label around line 87)
- Test: `__tests__/hooks/historyUtils.test.ts` (extend, or create if absent)

**Interfaces:**
- Consumes: `originLabel` (Task 9), `NoteOrigin` (Task 6).
- Produces: `HistoryItem.origin?: NoteOrigin`.

- [ ] **Step 1: Write the failing test**

Add to `__tests__/hooks/historyUtils.test.ts` (create it if the file does not exist, following the existing test layout):

```ts
import { buildHistoryItems } from '../../hooks/history/historyUtils';
import type { JournalEntry } from '../../services/journal/journalStorage.types';

const entry = (overrides: Partial<JournalEntry> = {}): JournalEntry => ({
    id: 'e1',
    title: 'Calm mornings',
    emoji: '📝',
    messages: [{ id: 'm1', role: 'user', content: 'Calm mornings help.', timestamp: 1 }],
    status: 'completed',
    createdAt: Date.UTC(2026, 8, 19),
    updatedAt: Date.UTC(2026, 8, 19),
    ...overrides,
});

describe('buildHistoryItems provenance', () => {
    it("carries 'threads' through so Archive can label it", () => {
        const items = buildHistoryItems([entry({ origin: 'threads' })], []);
        expect(items[0]?.origin).toBe('threads');
    });

    it('leaves origin undefined for a chat entry', () => {
        const items = buildHistoryItems([entry()], []);
        expect(items[0]?.origin).toBeUndefined();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --runInBand __tests__/hooks/historyUtils.test.ts`
Expected: FAIL — `expect(received).toBe("threads")` receives `undefined`.

- [ ] **Step 3: Carry the field through**

In `hooks/history/historyUtils.ts`, add to `HistoryItem`:

```ts
    /** Where the entry was written; absent on older entries → read as chat. */
    origin?: NoteOrigin;
```

Add `import type { NoteOrigin } from '@/services/journal/journalStorage.types';` and add to the journal mapper in `buildHistoryItems`:

```ts
            origin: entry.origin,
```

- [ ] **Step 4: Label the card and the detail screen**

In `components/history/HistoryEntryCard.tsx`, replace `resolveLabel`:

```ts
function resolveLabel(item: HistoryItem): string {
    if (item.type === 'checkin') {
        if (item.checkInType === 'evening') return 'Evening reflection';
        if (item.checkInType === 'morning') return 'Morning note';
        return 'Intention setting';
    }
    // A note written on Explore is a real entry, but it did not come from chat —
    // labelling it "Journal" would claim a conversation that never happened.
    return originLabel(item.origin);
}
```

and add `import { originLabel } from '@/components/memory/memoryDisplay';`.

In `app/entry-detail.tsx`, find the authored label comment around line 87 and append the origin to that line's text using `originLabel(entry.origin)`, so the detail screen names Threads too. Read the surrounding block before editing — keep the existing clock-doctrine format and only append.

- [ ] **Step 5: Run the tests**

Run: `npx jest --runInBand __tests__/hooks/historyUtils.test.ts __tests__/components/HistoryEntryCard.test.tsx __tests__/components/HistorySection.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add hooks/history/historyUtils.ts components/history/HistoryEntryCard.tsx \
        app/entry-detail.tsx __tests__/hooks/historyUtils.test.ts
git commit -m "feat(history): label notes written on Threads"
```

---

### Task 16: Full gate + live E2E + offline boot

**Why this is its own task:** AGENTS.md rule 7 — Jest green is not sufficient for memory-recall work. Unit tests can all pass while the real write path no-ops. This task is the only one that proves the note is actually recallable.

**Files:**
- Modify: `PROGRESS.md`
- Test: the suites below, plus `scripts/e2e/pw-memory-recall-offline.mjs`

- [ ] **Step 1: Run the full local gate**

```bash
npm run check:design
npx tsc --noEmit
npm run lint
npm test
```

All four must be clean. Fix every failure before continuing; do not proceed with a red gate.

- [ ] **Step 2: Live recall E2E against cleared demo data (required)**

First-launch seed pollutes digests and capsule, and residual seed rows have already invalidated recall assertions once (AGENTS.md rule 8). Clear demo data first.

```bash
npx expo start --web --port 8081
```

In the running app:

1. Settings → Clear History (removes entries, atoms, memory files, digests).
2. Go to `/explore`, write a distinctive note, e.g. *"The lighthouse lens needs a new copper gasket before winter."* Press Keep.
3. Open `/chat` and send: `search your memory for the lighthouse lens`.
4. Paste the assistant's **verbatim** reply into the task notes — not a summary.

Expected: `memory_search` returns the note's text verbatim. If the note is only reachable by the recency fallback and not by topic, record that as the actual outcome and say so; do not claim recall works when it does not.

- [ ] **Step 3: Confirm the tool can list the note by kind**

In the same chat session, ask the model to run `memory_list` with `kind: "note"`, and paste the reply. Expected: the note appears with `[note]` and nothing else does.

- [ ] **Step 4: Offline boot gate (required)**

```bash
E2E_BOOT_ONLY=1 node scripts/e2e/pw-memory-recall-offline.mjs
E2E_OFFLINE_WALK=1 node scripts/e2e/pw-memory-recall-offline.mjs
```

Expected: `/today` renders with content, **0 page errors**, and **no blocked outbound host other than the chat provider**. A new outbound host is a regression — the write path must add none.

- [ ] **Step 5: Light and dark QA against the prototype**

Open `example-design/blackrose/explore-variants/variant-a-index.html` beside the running `/explore` and compare, in both schemes:

1. Page head, hairline rule, then the composer leading the page.
2. The date column: month over day, serif, in the margin.
3. The theme strip drifts; the seam is invisible.
4. The list head says "Written" and rows carry a dated margin.
5. Every `<Text>` is legible in dark mode — no invisible text, no stuck-black chrome.
6. The empty state and the skeleton match the new layout.

Record any deliberate deviation and why.

- [ ] **Step 6: Update `PROGRESS.md`**

Add an entry under the current phase recording: what shipped, the four-store fan-out, the `'note'` type, the body-first write-ordering fix, the deletions, the live recall evidence pasted verbatim, and any follow-up (the orphan-header reconciliation pass belongs to the Dream work in spec 3).

- [ ] **Step 7: Commit**

```bash
git add PROGRESS.md
git commit -m "docs(progress): record the Explore write path and its live verification"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task |
|---|---|
| §3 `saveExploreNote` + write order + no model call | 8 (incl. the import-graph guard) |
| §3 deferred to Dream | 8 (nothing calls identity extraction or session digests) |
| §4.1 `'note'` type + supersession skip + tool trap | 1, 4, 5 |
| §4.2 `stageUserNoteMemory` | 2 |
| §4.3 journal `origin` | 6, 15 |
| §4.4 atom provenance | 8 (asserted) |
| §4.5 theme source + `topMemoryThemes` fix | 7, 9 |
| §5 UI port, composer, date column, drift strip, a11y rule, deletions, guard tests | 10, 11, 12, 14 |
| §6 carve-out: body-first + reconciliation | 3 |
| §7 failure modes | 8 (all six rows have a test) |
| §8 unit tests 1-10 | 8, 2, 1, 5, 4, 9 |
| §8 live/E2E 11-13 | 16 |
| §8 sabotage discipline | Tasks 1, 3 |

No gaps. §9 (out of scope) is correctly excluded.

**2. Placeholder scan**

No "TBD", "similar to Task N", or "add appropriate error handling". Task 14's screen body is described structurally with the exact strings the guards pin, rather than reproduced in full — the file is a rewrite of an existing 393-line screen whose unchanged parts (header, overflow menu, search, Show more, BottomNav) are already on disk and are named explicitly. Every other code step carries complete code.

**3. Type consistency**

- `MEMORY_FILE_TYPES` / `MemoryFileType` — defined Task 1, consumed Tasks 2, 5.
- `stageUserNoteMemory(StageUserNoteInput)` — defined Task 2, consumed Task 8.
- `findOrphanManifestHeaders()` — defined Task 3, tested Task 3.
- `extractTags` — moved Task 7, consumed Tasks 8, 9.
- `saveExploreNote` / `ExploreNoteResult` / `ExploreNoteFailure` / `deriveNoteTitle` / `MAX_EXPLORE_NOTE_CHARS` — defined Task 8, consumed Tasks 13, 14.
- `NoteOrigin` — defined Task 6, consumed Tasks 9, 15.
- `themesForText` / `formatLedgerDate` / `originLabel` — defined Task 9, consumed Tasks 10, 11, 14, 15.
- `ExploreComposer` / `MemoryLedgerRow` / `ThemeDriftStrip` props — defined Tasks 10-12, consumed Task 14.
- `useLocalMemories` return shape — defined Task 13, consumed Task 14 (`addExploreNote`, and `generatedNote` is gone from both).

**4. Review Focus**

All six lines have an owning test: (1) Task 8 clipped-value test; (2) Tasks 2 and 8 hint-less tests; (3) Task 8 blank-text test; (4) Task 8 digest-merge test; (5) Task 5 kind-coercion tests; (6) Task 3 ordering tests.

**Deviation from the spec, recorded:** the spec's §5 deletion list does not mention `MemoryAtomCard` or its test, but names `MemoryLedgerRow` as its replacement. Task 11 deletes both, since leaving an unused card would keep a dead second way to render a memory.

**5. Empirically validated before writing (not assumed)**

The plan's exact-string and storage assumptions were probed against the real modules with a throwaway test, then that test was deleted. What the probes changed:

- `extractTags` expectations in Tasks 7 and 9 (`['mornings','calm','help','think']`, `[]` for `'it was a day'`, seed tags first, cap of 8) all hold exactly as written.
- `deriveNoteTitle` returns `"Calm mornings help."` for the two-sentence input, and the 40-word input yields a 60-char title ending in `…` with no mid-word cut. Both assertions in Task 8 are correct as written.
- **Corrected:** the day digest has its own storage adapter (`setDayDigestStorageAdapter`). Task 8's original setup did not set it, so every digest assertion would have read from the jest AsyncStorage mock and failed confusingly. Now set in `beforeEach`.
- **Corrected:** `buildDigestSummary` carries only the **latest** source's snippet, so the original Task 8 assertion (`summary` contains both "kiln" and "glaze") was wrong. It is now asserted against `digest.sources` (which does hold both) with the summary's actual shape pinned explicitly.
- **Corrected:** the partial-failure test originally spied on a `jest.fn` adapter's `setItem`; the store takes a plain adapter object, so the test now passes a purpose-built failing adapter.
- **Corrected:** the supersession suite lives at `__tests__/services/memory/memorySupersession.test.ts`, not under `__tests__/services/`.

Baseline before any change: the 11 suites this plan touches are green — 70 tests, 0 failures. That is the "before" for every RED/GREEN claim in the tasks above.
