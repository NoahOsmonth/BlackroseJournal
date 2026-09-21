/* eslint-disable import/first */

jest.mock('@/services/memory/memoryAtomExtraction', () => ({
    extractJournalMemoryAtoms: jest.fn(async () => []),
    extractCheckInMemoryAtoms: jest.fn(async () => []),
}));

import { deriveNoteTitle, saveExploreNote } from '../../services/memory/exploreNote';
import { listMemoryAtoms, resetMemoryStorageAdapter, setMemoryStorageAdapter } from '../../services/memory/localMemory';
import {
    clearMemoryFiles,
    getMemoryRecordsByIds,
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
    listEntries,
    resetStorageAdapter,
    setStorageAdapter,
} from '../../services/journal/journalStorage';
import type { StorageAdapter } from '../../services/journal/journalStorage.types';
import { getLocalDateKeyFromTimestamp } from '../../utils/date';

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
        // Detach the files adapter first: the failure-path test deliberately
        // leaves a broken adapter installed, and `clearMemoryFiles` rewrites the
        // manifest — with that adapter still in place the teardown itself rejects
        // and fails the test even though the unit behaved correctly.
        resetMemoryFilesStorageAdapter();
        await clearAllEntries();
        await clearMemoryFiles();
        resetStorageAdapter();
        resetMemoryStorageAdapter();
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
        await expect(getDayDigest(getLocalDateKeyFromTimestamp(NOW))).resolves.toMatchObject({ entryCount: 1 });
        expect(result.failures).toEqual([]);
    });

    it('rejects blank text before writing anything', async () => {
        await expect(saveExploreNote({ text: '   \n  ', now: NOW })).rejects.toThrow('Note text is required');
        // All three stores, not just the derived two: "before writing anything"
        // is only true if the journal store is empty too. A throw moved after
        // `createEntry` would leave an empty entry behind and pass without this.
        await expect(listEntries()).resolves.toEqual([]);
        await expect(listMemoryAtoms()).resolves.toEqual([]);
        await expect(listTmpFiles()).resolves.toEqual([]);
    });

    it('feeds one clipped value to every store so recall returns what the composer showed', async () => {
        const long = 'lighthouse '.repeat(120).trim(); // 1319 chars
        const result = await saveExploreNote({ text: long, now: NOW });

        const atoms = await listMemoryAtoms();
        const files = await listTmpFiles();
        const entry = await getEntry(result.entry.id);
        const entryText = entry?.messages[0]?.content ?? '';

        expect(entryText.length).toBe(600);
        expect(atoms[0]?.content).toBe(entryText);
        // The header name is `Note: ${text.slice(0, 60)}`, so it is byte-identical
        // whether the file got 600 chars or 1319 — it cannot see the stored body.
        // Assert on the body itself, which is what `memory_search` returns.
        expect(files[0]?.name).toContain(entryText.slice(0, 40));
        // Body shape is `## Note\n<text>\n\n## Notes\n...`, so the second line is
        // the note verbatim.
        expect(result.file?.content.split('\n')[1]).toBe(entryText);
        // Read it back the way recall does, through the store's own API.
        const [stored] = await getMemoryRecordsByIds([files[0]!.id]);
        expect(stored?.content.split('\n')[1]).toBe(entryText);
        // The unclipped value must not be anywhere in the persisted body.
        expect(stored?.content).not.toContain(long);
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
        const digest = await getDayDigest(getLocalDateKeyFromTimestamp(NOW));
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
