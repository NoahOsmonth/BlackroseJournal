/**
 * Name-drift regression for the edit-staleness fix.
 *
 * The first cut of `refreshJournalEntryMemoryFiles` matched drafts to existing
 * files by `header.name === draft.name`. That name embeds BOTH the analysis topic
 * and the entry title, and in production the finish path stages BEFORE analysis
 * exists:
 *
 *   hooks/chat/useJournalChatFinish.ts:141-146  create({ title, emoji, messages, status })
 *                                               <- no `analysis` field
 *   journalFinishSideEffects.ts:227-230         stageJournalEntryMemoryFiles(savedEntry)
 *                                               <- the same analysis-less object
 *
 * The analysis step runs concurrently and is persisted afterwards, so when the
 * user later edits, the entry loads WITH topics and the draft name becomes
 * "<Topic>: <title>". It never matched the staged "General: <title>", so the
 * original file was orphaned and a duplicate staged fresh — one entry owning two
 * memory files, one of them stale, later split across two threads by Dream.
 *
 * The earlier suite missed this because its fixture always carries `analysis`, so
 * finish and edit produced the same name. These tests drive the real production
 * ordering, a title change, duplicate topics, and the retirement case.
 */
import {
    deprecateRecord,
    listAllMemoryHeaders,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
} from '../../../services/memory/memoryFiles';
import { refreshJournalEntryMemoryFiles, stageJournalEntryMemoryFiles } from '../../../services/memory/memoryStage';
import type { JournalEntry } from '../../../services/journal/journalStorage.types';

const ORIGINAL = 'The kiln cooled overnight and the glaze crazed into a fine web.';
const EDITED = 'The kiln shattered at noon and the glaze ran clear across the shelf.';
const ENTRY_ID = 'entry-kiln-drift';

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

type Adapter = ReturnType<typeof createAdapter>;

function entry(overrides: Partial<JournalEntry> = {}): JournalEntry {
    const createdAt = new Date(2026, 6, 12, 10, 0, 0).getTime();
    return {
        id: ENTRY_ID,
        title: 'Kiln notes',
        emoji: '🔥',
        messages: [{ id: 'm1', role: 'user', content: ORIGINAL, timestamp: createdAt }],
        status: 'completed',
        createdAt,
        updatedAt: createdAt,
        ...overrides,
    };
}

/** The analysis the finish path backfills after staging (topics are NOT set at stage time). */
function backfilledAnalysis() {
    return {
        insight: 'Heat work keeps surprising me.',
        quote: 'crazed',
        mood: 'curious',
        topics: ['Kiln'],
        generatedAt: new Date(2026, 6, 12, 10, 5, 0).getTime(),
    };
}

async function liveFilesFor(adapter: Adapter, entryId: string) {
    const headers = (await listAllMemoryHeaders()).filter((h) => h.sourceSessionKey === entryId && !h.deprecated);
    return Promise.all(
        headers.map(async (h) => ({
            header: h,
            body: (await adapter.getItem(`@blackrose_memory_file:${h.id}`)) ?? '',
        })),
    );
}

describe('edit refresh survives name drift between finish and edit', () => {
    let adapter: Adapter;

    beforeEach(() => {
        adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
    });

    afterEach(() => {
        resetMemoryFilesStorageAdapter();
    });

    it('rewrites in place when finish staged without analysis (the production ordering)', async () => {
        // Finish: no analysis on the entry yet -> stages "General: Kiln notes".
        const staged = entry();
        await stageJournalEntryMemoryFiles(staged);
        expect((await listAllMemoryHeaders()).map((h) => h.name)).toEqual(['General: Kiln notes']);

        // Analysis is backfilled afterwards, so the edit builds "Kiln: Kiln notes".
        const edited = entry({
            analysis: backfilledAnalysis(),
            messages: [{ id: 'm1', role: 'user', content: EDITED, timestamp: staged.createdAt }],
        });
        await refreshJournalEntryMemoryFiles(edited);

        const files = await liveFilesFor(adapter, ENTRY_ID);
        expect(files).toHaveLength(1);
        expect(files[0].body).toContain('shattered at noon');
        expect(files[0].body).not.toContain('crazed into a fine web');
    });

    it('rewrites in place when the title changes between finish and edit', async () => {
        await stageJournalEntryMemoryFiles(entry({ analysis: backfilledAnalysis() }));

        const renamed = entry({
            title: 'Kiln disaster',
            analysis: backfilledAnalysis(),
            messages: [{ id: 'm1', role: 'user', content: EDITED, timestamp: new Date(2026, 6, 12, 10, 0, 0).getTime() }],
        });
        await refreshJournalEntryMemoryFiles(renamed);

        const files = await liveFilesFor(adapter, ENTRY_ID);
        expect(files).toHaveLength(1);
        expect(files[0].body).toContain('shattered at noon');
    });

    it('does not stage a second file when the analysis repeats a topic in another case', async () => {
        await stageJournalEntryMemoryFiles(entry({ analysis: backfilledAnalysis() }));
        expect(await liveFilesFor(adapter, ENTRY_ID)).toHaveLength(1);

        const duplicated = entry({
            analysis: { ...backfilledAnalysis(), topics: ['Kiln', 'kiln'] },
            messages: [{ id: 'm1', role: 'user', content: EDITED, timestamp: new Date(2026, 6, 12, 10, 0, 0).getTime() }],
        });
        await refreshJournalEntryMemoryFiles(duplicated);

        expect(await liveFilesFor(adapter, ENTRY_ID)).toHaveLength(1);
    });

    it('does not resurrect a memory that supersession retired', async () => {
        await stageJournalEntryMemoryFiles(entry({ analysis: backfilledAnalysis() }));
        const headers = await listAllMemoryHeaders();
        await deprecateRecord(headers[0].id, { supersededBy: 'other-entry', reason: 'restated' });
        expect(await liveFilesFor(adapter, ENTRY_ID)).toHaveLength(0);

        // Editing the retired entry must not bring it back: the next Dream would
        // promote it and retire the entry that supersession had chosen.
        const edited = entry({
            analysis: backfilledAnalysis(),
            messages: [{ id: 'm1', role: 'user', content: EDITED, timestamp: new Date(2026, 6, 12, 10, 0, 0).getTime() }],
        });
        await refreshJournalEntryMemoryFiles(edited);

        // No live file came back. `listAllMemoryHeaders` omits deprecated headers,
        // so a zero count here is the retirement holding, not the file vanishing.
        expect(await liveFilesFor(adapter, ENTRY_ID)).toHaveLength(0);
    });

    it('still updates in place across repeated edits without accumulating files', async () => {
        await stageJournalEntryMemoryFiles(entry({ analysis: backfilledAnalysis() }));
        const createdAt = new Date(2026, 6, 12, 10, 0, 0).getTime();

        for (const text of ['First revision about the kiln.', 'Second revision about the kiln.', EDITED]) {
            await refreshJournalEntryMemoryFiles(entry({
                analysis: backfilledAnalysis(),
                messages: [{ id: 'm1', role: 'user', content: text, timestamp: createdAt }],
            }));
        }

        const files = await liveFilesFor(adapter, ENTRY_ID);
        expect(files).toHaveLength(1);
        expect(files[0].body).toContain('shattered at noon');
    });
});
