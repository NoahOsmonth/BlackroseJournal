/* eslint-disable import/first */

/**
 * Edit-staleness regression (JOURNAL-10).
 *
 * Recall (`memoryRetrieval.ts`) reads ONLY offline memory files, never atoms.
 * So when `updateJournalEntryText` refreshes atoms + the day digest but leaves
 * the entry's memory file untouched, `memory_search` keeps returning the
 * ORIGINAL text forever.
 *
 * This suite drives the real memory store (memoryFiles + memoryStage +
 * memoryRetrieval) end to end. It deliberately promotes the entry's file
 * through Dream first, because that is where the naive "delete the session's
 * files and re-stage" fix breaks: `deleteMemoryFilesBySourceSessions` matches
 * every file carrying the session key — including the promoted thread file,
 * which inherits it — and the freshly staged `_tmp` replacement is invisible to
 * thread-scoped recall. The assertions below pin both halves: the memory stays
 * findable AND returns the new words, with the same id and the same thread.
 */

jest.mock('../../../services/memory/localMemory', () => ({
    saveJournalEntryMemories: jest.fn(async () => []),
    deleteMemoryAtomsByRootSource: jest.fn(async () => 0),
}));
jest.mock('../../../services/memory/dayDigestStorage', () => ({
    upsertJournalDayDigest: jest.fn(async () => null),
    removeDayDigestSource: jest.fn(async () => 1),
}));
jest.mock('../../../services/memory/sessionDigestStorage', () => ({
    deleteSessionDigest: jest.fn(async () => true),
}));
jest.mock('../../../services/journal/journalStorage', () => ({
    getEntry: jest.fn(),
    updateEntry: jest.fn(),
    deleteEntry: jest.fn(),
}));

import { updateJournalEntryText } from '../../../services/journal/journalEntryActions';
import { getEntry, updateEntry } from '../../../services/journal/journalStorage';
import { runMemoryDream } from '../../../services/memory/memoryDream';
import {
    clearMemoryFiles,
    getMemoryRecordsByIds,
    listFormalProjectIds,
    listLiveMemoryHeadersBySourceSession,
    listTmpFiles,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
} from '../../../services/memory/memoryFiles';
import { clearMemoryRecallCache, retrieveMemory } from '../../../services/memory/memoryRetrieval';
import { stageJournalEntryMemoryFiles } from '../../../services/memory/memoryStage';
import type { JournalEntry } from '../../../services/journal/journalStorage.types';

const ORIGINAL = 'The kiln cooled overnight and the glaze crazed.';
const EDITED = 'The kiln shattered at noon and the glaze ran clear.';
const ENTRY_ID = 'entry-kiln-1';

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

function entry(overrides: Partial<JournalEntry> = {}): JournalEntry {
    const createdAt = new Date(2026, 6, 12, 10, 0, 0).getTime();
    return {
        id: ENTRY_ID,
        title: 'Kiln notes',
        emoji: '🔥',
        messages: [{ id: 'm1', role: 'user', content: ORIGINAL, timestamp: createdAt }],
        status: 'completed',
        analysis: {
            insight: 'Heat work keeps surprising me.',
            quote: 'crazed',
            mood: 'curious',
            topics: ['Kiln'],
            generatedAt: createdAt,
        },
        createdAt,
        updatedAt: createdAt,
        ...overrides,
    };
}

const mockedGetEntry = getEntry as jest.MockedFunction<typeof getEntry>;
const mockedUpdateEntry = updateEntry as jest.MockedFunction<typeof updateEntry>;

describe('editing a journal entry refreshes its offline memory (recall stays correct)', () => {
    beforeEach(() => {
        setMemoryFilesStorageAdapter(createAdapter());
        clearMemoryRecallCache();
        jest.clearAllMocks();
    });

    afterEach(async () => {
        await clearMemoryFiles();
        resetMemoryFilesStorageAdapter();
        clearMemoryRecallCache();
    });

    it('recall returns the NEW text and the Dream-promoted file is updated in place', async () => {
        const original = entry();

        // Finish path, then Dream: the promoted thread file inherits the source
        // session key — exactly the file a delete-and-restage fix would destroy.
        await stageJournalEntryMemoryFiles(original);
        const dream = await runMemoryDream({ tryLlm: false });
        expect(dream.promoted).toBe(1);
        expect(await listTmpFiles()).toHaveLength(0);
        expect(await listFormalProjectIds()).toEqual(['kiln']);

        const promotedBefore = await listLiveMemoryHeadersBySourceSession(original.id);
        expect(promotedBefore).toHaveLength(1);
        const promotedId = promotedBefore[0].id;
        const promotedCapturedAt = promotedBefore[0].capturedAt;

        // Baseline: recall cites the original words.
        const baseline = await retrieveMemory('kiln notes');
        expect(baseline.debug.resolvedProjectId).toBe('kiln');
        expect(baseline.context).toContain('cooled overnight');

        // Edit. `updateEntry` is mocked to return the merged entry (analysis
        // preserved), which is what the service re-derives its artifacts from.
        const edited = entry({
            messages: [{ id: 'm1', role: 'user', content: EDITED, timestamp: original.createdAt }],
        });
        mockedGetEntry.mockResolvedValue(original);
        mockedUpdateEntry.mockResolvedValue(edited);

        await updateJournalEntryText(original.id, EDITED);

        // The promoted file is the SAME file: same id, same thread, no `_tmp`
        // replacement staged beside it.
        const live = await listLiveMemoryHeadersBySourceSession(original.id);
        expect(live.map((h) => h.id)).toEqual([promotedId]);
        expect(live[0].projectId).toBe('kiln');
        expect(live[0].capturedAt).toBe(promotedCapturedAt);
        expect(await listFormalProjectIds()).toEqual(['kiln']);
        expect(await listTmpFiles()).toHaveLength(0);

        // Its stored body now carries the edited words, not the original.
        const [record] = await getMemoryRecordsByIds([promotedId]);
        expect(record.content).toContain('shattered at noon');
        expect(record.content).not.toContain('cooled overnight');

        // And thread-scoped recall returns the new text — the actual bug.
        clearMemoryRecallCache();
        const after = await retrieveMemory('kiln notes');
        expect(after.debug.resolvedProjectId).toBe('kiln');
        expect(after.context).toContain('shattered at noon');
        expect(after.context).not.toContain('cooled overnight');
    });

    it('stages a fresh file when the entry had never been staged', async () => {
        const original = entry();
        const edited = entry({
            messages: [{ id: 'm1', role: 'user', content: EDITED, timestamp: original.createdAt }],
        });
        mockedGetEntry.mockResolvedValue(original);
        mockedUpdateEntry.mockResolvedValue(edited);

        await updateJournalEntryText(original.id, EDITED);

        const tmp = await listTmpFiles();
        expect(tmp).toHaveLength(1);
        expect(tmp[0].sourceSessionKey).toBe(ENTRY_ID);
        const [record] = await getMemoryRecordsByIds([tmp[0].id]);
        expect(record.content).toContain('shattered at noon');
    });
});
