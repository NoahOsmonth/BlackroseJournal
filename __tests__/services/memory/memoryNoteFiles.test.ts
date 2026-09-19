import {
    clearMemoryFiles,
    getMemoryRecordsByIds,
    listMemoryFiles,
    listTmpFiles,
    MEMORY_FILE_BODY_PREFIX,
    MEMORY_FILES_MANIFEST_KEY,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
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
