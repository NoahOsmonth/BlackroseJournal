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
