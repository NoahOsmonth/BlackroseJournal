import {
    clearMemoryFiles,
    getMemoryRecordsByIds,
    listMemoryFiles,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
    stageTmpMemory,
} from '../../services/memory/memoryFiles';

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

describe('memoryFiles (offline file-semantic store)', () => {
    it('stages tmp memories and lists headers without body reads', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            const staged = await stageTmpMemory({
                type: 'project',
                name: 'Promotion Plan',
                description: 'Holiday campaign stage',
                body: '## Current Stage\nPlanning holiday push',
                sourceSessionKey: 's1',
            });
            expect(staged.projectId).toBe('_tmp');
            expect(staged.relativePath).toContain('projects/_tmp/Project/');

            adapter.getItem.mockClear();
            const headers = await listMemoryFiles({});
            expect(headers).toHaveLength(1);
            expect(headers[0]?.description).toBe('Holiday campaign stage');
            // Header-only: one manifest read, zero body reads.
            expect(adapter.getItem).toHaveBeenCalledTimes(1);
        } finally {
            resetMemoryFilesStorageAdapter();
        }
    });

    it('loads bodies only for exact ids and skips unknown ids', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            const staged = await stageTmpMemory({
                type: 'feedback',
                name: 'Delivery Rule',
                description: 'Report format',
                body: '## Rule\nLead with outcomes',
            });
            const records = await getMemoryRecordsByIds([staged.id, 'projects/nope/Project/x.md']);
            expect(records).toHaveLength(1);
            expect(records[0]?.content).toContain('Lead with outcomes');
        } finally {
            resetMemoryFilesStorageAdapter();
        }
    });

    it('filters by kind and query, excludes deprecated by default', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            await stageTmpMemory({
                type: 'project', name: 'Work Thread', description: 'deadline pressure', body: '## Current Stage\nBusy',
            });
            await stageTmpMemory({
                type: 'feedback', name: 'Format Rule', description: 'short replies', body: '## Rule\nBe brief',
            });
            expect(await listMemoryFiles({ kind: 'project' })).toHaveLength(1);
            expect(await listMemoryFiles({ query: 'deadline pressure' })).toHaveLength(1);
            expect(await listMemoryFiles({ query: 'nothing matches this' })).toHaveLength(0);
        } finally {
            resetMemoryFilesStorageAdapter();
        }
    });

    it('clearMemoryFiles wipes manifest and bodies', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            const staged = await stageTmpMemory({
                type: 'project', name: 'Tmp', description: 'tmp', body: '## Current Stage\nx',
            });
            await clearMemoryFiles();
            expect(await listMemoryFiles({})).toHaveLength(0);
            expect(await getMemoryRecordsByIds([staged.id])).toHaveLength(0);
        } finally {
            resetMemoryFilesStorageAdapter();
        }
    });
});
