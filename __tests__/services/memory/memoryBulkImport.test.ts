/**
 * Regression tests for the memory backup path at scale — export AND restore.
 *
 * Both halves of `driveBackup` carried the same bug shape: a bound that was
 * applied to one side only, or applied before validation, with no signal.
 *
 *   - `buildMemorySnapshot` paginated the manifest "so large file sets export
 *     fully", then passed every page to `getMemoryRecordsByIds`, which sliced to
 *     ten. A 500-file store exported ten files.
 *   - `importMemoryFiles` sliced to 1000 *before* comparing lengths, so 1001+
 *     valid records threw `Backup contains invalid memory file records` — a
 *     corruption message for a size limit.
 *
 * The atoms path is deliberately NOT in that list. It looked like a fourth case —
 * `restoreMemorySnapshot` loops `raw.atoms.slice(0, MAX_MEMORY_ATOMS)` — but the
 * store's own cap is what bounds a snapshot, so the slice is redundant rather than
 * lossy. What was worth fixing there is that the bound was written twice: restore
 * now references the store's own constant so the two cannot drift apart, and it
 * writes the whole snapshot in one locked batch instead of one full-store
 * round trip per atom. The atom test below pins that relationship instead of a
 * truncation that does not happen.
 */
import {
    buildMemorySnapshot,
    restoreMemorySnapshot,
} from '../../../services/backup/driveBackup';
import {
    clearMemoryAtoms,
    importMemoryAtoms,
    listMemoryAtoms,
    MAX_MEMORY_ATOMS,
    resetMemoryStorageAdapter,
    setMemoryStorageAdapter,
} from '../../../services/memory/localMemory';
import {
    clearMemoryFiles,
    importMemoryFiles,
    listMemoryFiles,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
} from '../../../services/memory/memoryFiles';
import { resetIdentityStorageAdapter, setIdentityStorageAdapter } from '../../../services/memory/identityProfile';
import type { MemoryFileImportRecord } from '../../../services/memory/memoryFiles';

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

const THREAD_COUNT = 20;
const TIMESTAMP = new Date(Date.UTC(2026, 8, 1, 9, 0, 0)).toISOString();

function validRecords(count: number): MemoryFileImportRecord[] {
    const records: MemoryFileImportRecord[] = [];
    for (let i = 0; i < count; i += 1) {
        const thread = String(i % THREAD_COUNT);
        const id = 'projects/thread-' + thread + '/Project/note-' + String(i) + '.md';
        records.push({
            header: {
                id,
                relativePath: id,
                name: 'Note ' + String(i),
                description: 'Thread hint thread-' + thread + '. Entry ' + String(i) + '.',
                type: 'project',
                scope: 'project',
                projectId: 'thread-' + thread,
                updatedAt: TIMESTAMP,
                capturedAt: TIMESTAMP,
            },
            content: '## Current Stage\nEntry ' + String(i) + ' with its own distinct body text.',
        });
    }
    return records;
}

async function seedAtoms(count: number): Promise<void> {
    // Batched: at a full store a per-atom upsert re-reads and re-serializes every
    // atom, so seeding 4000 one at a time is 4000 full-store round trips.
    await importMemoryAtoms(Array.from({ length: count }, (_, index) => ({
        layer: 'episodic' as const,
        source: 'journal' as const,
        sourceId: 'atom-' + String(index),
        title: 'Atom ' + String(index),
        content: 'Body text for atom ' + String(index) + '.',
        createdAt: Date.UTC(2026, 8, 1) + index * 60_000,
    })));
}

describe('memory backup round trip at scale', () => {
    beforeEach(() => {
        setMemoryFilesStorageAdapter(createAdapter());
        setMemoryStorageAdapter(createAdapter());
        setIdentityStorageAdapter(createAdapter());
    });

    afterEach(async () => {
        await clearMemoryFiles();
        await clearMemoryAtoms();
        resetIdentityStorageAdapter();
        resetMemoryStorageAdapter();
        resetMemoryFilesStorageAdapter();
    });

    it('exports every file, not just the first ten', async () => {
        await importMemoryFiles(validRecords(500));

        const snapshot = await buildMemorySnapshot();

        expect(snapshot.files).toHaveLength(500);
    });

    it('restores a backup larger than one import batch', async () => {
        await importMemoryFiles(validRecords(1200));
        const snapshot = await buildMemorySnapshot();

        await clearMemoryFiles();
        const { importedFiles, skippedFiles } = await restoreMemorySnapshot(snapshot);

        expect(importedFiles).toBe(1200);
        expect(skippedFiles).toBe(0);
        expect(await listMemoryFiles({ limit: 50 })).toHaveLength(50);
    });

    it('still fails closed on a genuinely invalid record', async () => {
        await importMemoryFiles(validRecords(3));
        const snapshot = await buildMemorySnapshot();
        const files: unknown[] = [...snapshot.files, { header: { id: 'bad' }, content: 7 }];

        await expect(restoreMemorySnapshot({ ...snapshot, files })).rejects.toThrow(
            'Backup contains invalid memory file records',
        );
    });

    it('counts re-imported ids as skipped rather than duplicating them', async () => {
        await importMemoryFiles(validRecords(1100));
        const snapshot = await buildMemorySnapshot();

        await clearMemoryFiles();
        await restoreMemorySnapshot(snapshot);
        const { importedFiles, skippedFiles } = await restoreMemorySnapshot(snapshot);

        expect(importedFiles).toBe(0);
        expect(skippedFiles).toBe(1100);
    });

    it('round-trips every atom the store is willing to hold', async () => {
        // The store prunes to MAX_MEMORY_ATOMS, so seeding past the cap is the
        // honest way to reach a full store.
        await seedAtoms(MAX_MEMORY_ATOMS + 50);
        const stored = await listMemoryAtoms();
        expect(stored).toHaveLength(MAX_MEMORY_ATOMS);

        const snapshot = await buildMemorySnapshot();
        expect(snapshot.atoms).toHaveLength(MAX_MEMORY_ATOMS);

        await clearMemoryAtoms();
        const result = await restoreMemorySnapshot(snapshot);

        // Restore must not be the tighter of the two bounds.
        expect(result.restoredAtoms).toBe(MAX_MEMORY_ATOMS);
        expect(await listMemoryAtoms()).toHaveLength(MAX_MEMORY_ATOMS);
    });
});
