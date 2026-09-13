import { memoryDreamTool, memoryFlushTool, memoryOverviewTool } from '../../services/ai/tools/memoryFileTools';
import { getRegisteredTools } from '../../services/ai/tools/registry';
import { runMemoryDream } from '../../services/memory/memoryDream';
import {
    clearMemoryFiles,
    listFormalProjectIds,
    listTmpFiles,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
} from '../../services/memory/memoryFiles';
import { clearMemoryRecallCache, retrieveMemory } from '../../services/memory/memoryRetrieval';
import {
    stageCheckInMemoryFiles,
    stageJournalEntryMemoryFiles,
} from '../../services/memory/memoryStage';
import type { JournalEntry } from '../../services/journal/journalStorage.types';
import type { IntentionCheckIn } from '../../services/intentions/intentionsStorage.types';

function createAdapter() {
    const store = new Map<string, string>();
    return {
        getItem: jest.fn(async (key: string) => store.get(key) ?? null),
        setItem: jest.fn(async (key: string, value: string) => {
            store.set(key, value);
        }),
        removeItem: jest.fn(async (key: string) => {
            store.delete(key);
        }),
    };
}

function journalEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
    const createdAt = overrides.createdAt ?? new Date(2026, 6, 12, 10, 0, 0).getTime();
    return {
        id: 'entry-stage-1',
        title: 'Promotion stress',
        emoji: '😓',
        messages: [
            { id: 'm1', role: 'user', content: 'The holiday campaign keeps slipping.', timestamp: createdAt },
        ],
        status: 'completed',
        analysis: {
            insight: 'Campaign pressure is high.',
            quote: 'slipping',
            mood: 'stressed',
            topics: ['Work', 'Deadlines'],
            generatedAt: createdAt,
        },
        createdAt,
        updatedAt: createdAt,
        ...overrides,
    };
}

describe('memory staging + Dream (Wave 2)', () => {
    beforeEach(() => {
        setMemoryFilesStorageAdapter(createAdapter());
        clearMemoryRecallCache();
    });

    afterEach(async () => {
        await clearMemoryFiles();
        resetMemoryFilesStorageAdapter();
    });

    it('stages one tmp file per topic and never duplicates a re-finish', async () => {
        const entry = journalEntry();
        const first = await stageJournalEntryMemoryFiles(entry);
        expect(first).toHaveLength(2);
        expect(first.every((f) => f.projectId === '_tmp')).toBe(true);
        const second = await stageJournalEntryMemoryFiles(entry);
        expect(second).toHaveLength(0);
        expect(await listTmpFiles()).toHaveLength(2);
    });

    it('skips drafts and empty check-ins', async () => {
        expect(await stageJournalEntryMemoryFiles(journalEntry({ status: 'draft' } as Partial<JournalEntry>))).toHaveLength(0);
        const empty: IntentionCheckIn = {
            id: 'ci-empty', intentionId: 'i1', type: 'morning', title: 'Morning',
            summary: '', status: 'completed', messages: [], createdAt: Date.now(), updatedAt: Date.now(),
        };
        expect(await stageCheckInMemoryFiles(empty)).toHaveLength(0);
    });

    it('Dream promotes tmp files into formal threads offline', async () => {
        await stageJournalEntryMemoryFiles(journalEntry());
        const outcome = await runMemoryDream({ tryLlm: false });
        expect(outcome.usedLlm).toBe(false);
        expect(outcome.promoted).toBe(2);
        expect(outcome.threads.sort()).toEqual(['deadlines', 'work']);
        expect(await listTmpFiles()).toHaveLength(0);
        expect(await listFormalProjectIds()).toEqual(['deadlines', 'work']);
    });

    it('Dream recalls formal threads after promotion', async () => {
        await stageJournalEntryMemoryFiles(journalEntry());
        await runMemoryDream({ tryLlm: false });
        const result = await retrieveMemory('work progress update');
        expect(result.debug.resolvedProjectId).toBe('work');
        expect(result.context).toContain('Campaign pressure');
    });

    it('overview, flush, and dream tools are registered and answer', async () => {
        const names = getRegisteredTools().map((t) => t.definition.name);
        expect(names).toEqual(expect.arrayContaining(['memory_overview', 'memory_flush', 'memory_dream']));
        await stageJournalEntryMemoryFiles(journalEntry());
        expect(await memoryOverviewTool({})).toContain('staged awaiting Dream: 2');
        // Empty journal/check-in stores (mocked AsyncStorage) → nothing new to stage.
        expect(await memoryFlushTool({})).toContain('staged 0 file(s)');
        expect(await memoryDreamTool({})).toContain('promoted 2 file(s)');
    });
});
