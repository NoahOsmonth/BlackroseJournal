import {
    clearMemoryFiles,
    findOrphanManifestHeaders,
    getMemoryRecordsByIds,
    listMemoryFiles,
    listTmpFiles,
    MEMORY_FILE_BODY_PREFIX,
    MEMORY_FILES_MANIFEST_KEY,
    promoteTmpRecord,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
    stageTmpMemory,
    stageUserNoteMemory,
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
function seedNoteHeader(
    adapter: ReturnType<typeof createAdapter>,
    type: string = 'note',
): string {
    const id = 'projects/_tmp/Note/calm-mornings-abc.md';
    adapter.store.set(MEMORY_FILES_MANIFEST_KEY, JSON.stringify({
        schemaVersion: 1,
        files: {
            [id]: {
                id,
                relativePath: id,
                name: 'Note: calm mornings help',
                description: 'Thread hint calm-mornings. calm mornings help me think.',
                type,
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

    it('drops a header whose type is not in the shared list', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            seedNoteHeader(adapter, 'garbage');
            await expect(listMemoryFiles({})).resolves.toEqual([]);
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });
});

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

    // The two tests above kill the process *instead of* the manifest save, so
    // the manifest never lands under either ordering. The bug needs the kill to
    // land *after* the manifest persists — that is the instant the header exists
    // and the body never arrives, which is precisely what manifest-first allows.
    it('leaves no dangling header when the process dies before the staged body lands', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            const realSetItem = adapter.setItem.getMockImplementation()!;
            adapter.setItem.mockImplementation(async (key: string, value: string) => {
                if (key.startsWith(MEMORY_FILE_BODY_PREFIX)) throw new Error('process killed');
                await realSetItem(key, value);
            });
            await expect(stageTmpMemory({
                type: 'project', name: 'Doomed', description: 'd', body: '## Current Stage\nx',
            })).rejects.toThrow('process killed');
            adapter.setItem.mockImplementation(realSetItem);

            await expect(findOrphanManifestHeaders()).resolves.toEqual([]);
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });

    it('keeps the _tmp source live when the process dies before the promoted body lands', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            const staged = await stageTmpMemory({
                type: 'project', name: 'Promote me', description: 'd',
                body: '## Current Stage\ncontent worth keeping',
            });
            const realSetItem = adapter.setItem.getMockImplementation()!;
            adapter.setItem.mockImplementation(async (key: string, value: string) => {
                if (key.startsWith(MEMORY_FILE_BODY_PREFIX)) throw new Error('process killed');
                await realSetItem(key, value);
            });
            await expect(promoteTmpRecord(staged.id, 'work')).rejects.toThrow('process killed');
            adapter.setItem.mockImplementation(realSetItem);

            // Manifest-first deprecates the source in the save that precedes the
            // body write, so a kill here retires the only copy that had bytes.
            const headers = await listMemoryFiles({});
            expect(headers.map((h) => h.id)).toEqual([staged.id]);
            await expect(findOrphanManifestHeaders()).resolves.toEqual([]);
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });
});
