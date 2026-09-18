/* eslint-disable import/first */

jest.mock('@/services/memory/memoryAtomExtraction', () => ({
    extractJournalMemoryAtoms: jest.fn(async () => []),
    extractCheckInMemoryAtoms: jest.fn(async () => []),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
    },
}));

import {
    deleteMemoryAtomsByRootSource,
    listMemoryAtoms,
    resetMemoryStorageAdapter,
    setMemoryStorageAdapter,
    upsertMemoryAtom,
} from '../../../services/memory/localMemory';
import {
    clearDayDigests,
    getDayDigest,
    listDayDigests,
    removeDayDigestSource,
    resetDayDigestStorageAdapter,
    setDayDigestStorageAdapter,
    upsertJournalDayDigest,
} from '../../../services/memory/dayDigestStorage';
import {
    deleteSessionDigest,
    listSessionDigestIndex,
    resetSessionDigestStorageAdapter,
    setSessionDigestStorageAdapter,
    upsertSessionDigest,
} from '../../../services/memory/sessionDigestStorage';
import type { JournalEntry } from '../../../services/journal/journalStorage.types';

function createAdapter() {
    const store = new Map<string, string>();
    return {
        store,
        getItem: async (key: string) => store.get(key) ?? null,
        setItem: async (key: string, value: string) => {
            store.set(key, value);
        },
        removeItem: async (key: string) => {
            store.delete(key);
        },
        multiGet: async (keys: readonly string[]) =>
            keys.map((key) => [key, store.get(key) ?? null] as [string, string | null]),
        multiRemove: async (keys: readonly string[]) => {
            keys.forEach((key) => store.delete(key));
        },
        getAllKeys: async () => Array.from(store.keys()),
    };
}

function entry(overrides: Partial<JournalEntry> = {}): JournalEntry {
    return {
        id: 'entry-1',
        title: 'Kiln notes',
        emoji: '🔥',
        messages: [
            { id: 'm1', role: 'user', content: 'The kiln cooled overnight.', timestamp: 1000 },
        ],
        status: 'completed',
        createdAt: new Date(2026, 8, 12, 10, 0, 0).getTime(),
        updatedAt: 1000,
        ...overrides,
    };
}

describe('deleteMemoryAtomsByRootSource', () => {
    beforeEach(() => {
        setMemoryStorageAdapter(createAdapter());
    });

    afterEach(() => {
        resetMemoryStorageAdapter();
    });

    it('drops every atom rooted at the entry, including fan-out provenance', async () => {
        await upsertMemoryAtom({
            layer: 'episodic',
            source: 'journal',
            sourceId: 'entry-1',
            rootSourceId: 'entry-1',
            rootSourceKind: 'journal_entry',
            title: 'Kiln',
            content: 'Worked on the kiln.',
        });
        // Legacy fan-out shape: `{root}:topic:{topic}` with no explicit root fields.
        await upsertMemoryAtom({
            layer: 'semantic',
            source: 'journal',
            sourceId: 'entry-1:topic:craft',
            title: 'Craft',
            content: 'Careful with glazes.',
        });
        await upsertMemoryAtom({
            layer: 'episodic',
            source: 'journal',
            sourceId: 'entry-2',
            rootSourceId: 'entry-2',
            rootSourceKind: 'journal_entry',
            title: 'Coffee',
            content: 'Went for a walk.',
        });

        await expect(deleteMemoryAtomsByRootSource('entry-1')).resolves.toBe(2);

        const remaining = await listMemoryAtoms();
        expect(remaining.map((atom) => atom.sourceId)).toEqual(['entry-2']);
    });

    it('is a no-op for an unknown root', async () => {
        await expect(deleteMemoryAtomsByRootSource('nope')).resolves.toBe(0);
        await expect(deleteMemoryAtomsByRootSource('')).resolves.toBe(0);
    });
});

describe('removeDayDigestSource', () => {
    beforeEach(async () => {
        setDayDigestStorageAdapter(createAdapter());
        await clearDayDigests();
    });

    afterEach(() => {
        resetDayDigestStorageAdapter();
    });

    it('removes just that source and rebuilds the summary', async () => {
        await upsertJournalDayDigest(entry({ id: 'entry-1', title: 'Kiln notes' }));
        await upsertJournalDayDigest(entry({
            id: 'entry-2',
            title: 'Long walk',
            createdAt: new Date(2026, 8, 12, 18, 0, 0).getTime(),
        }));

        const touched = await removeDayDigestSource('journal_entry', 'entry-1');
        expect(touched).toBe(1);

        const digest = await getDayDigest('2026-09-12');
        expect(digest?.sources.map((source) => source.id)).toEqual(['entry-2']);
        expect(digest?.summary).toContain('Long walk');
        expect(digest?.summary).not.toContain('Kiln notes');
    });

    it('drops the day entirely once its last source is gone', async () => {
        await upsertJournalDayDigest(entry());
        await removeDayDigestSource('journal_entry', 'entry-1');
        await expect(getDayDigest('2026-09-12')).resolves.toBeNull();
        await expect(listDayDigests()).resolves.toEqual([]);
    });
});

describe('deleteSessionDigest', () => {
    beforeEach(() => {
        setSessionDigestStorageAdapter(createAdapter());
    });

    afterEach(() => {
        resetSessionDigestStorageAdapter();
    });

    async function seed(sessionId: string) {
        await upsertSessionDigest({
            schemaVersion: 1,
            sessionId,
            dateISO: '2026-09-12',
            oneLineSummary: `${sessionId} summary`,
            topics: ['craft'],
            entryWordCount: 120,
            createdAt: 1000,
            sourceKind: 'journal_entry',
            sourceId: sessionId,
        } as never);
    }

    it('retires the record and its index row only', async () => {
        await seed('entry-1');
        await seed('entry-2');

        await expect(deleteSessionDigest('entry-1')).resolves.toBe(true);

        const index = await listSessionDigestIndex();
        expect(index.map((row) => row.id)).toEqual(['entry-2']);
    });

    it('reports false when there is nothing to delete', async () => {
        await expect(deleteSessionDigest('missing')).resolves.toBe(false);
    });
});
