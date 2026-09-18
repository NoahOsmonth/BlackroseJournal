import {
    clearMemoryFiles,
    deleteMemoryFilesBySourceSessions,
    getMemoryRecordsByIds,
    listMemoryFiles,
    listTmpFiles,
    MEMORY_FILES_MANIFEST_KEY,
    promoteTmpRecord,
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

    it('deletes only the files staged from the given sessions', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            const seededCheckIn = await stageTmpMemory({
                type: 'project',
                name: 'Morning intention: demo',
                description: 'Thread hint morning-intentions. demo',
                body: '## Current Stage\nSeeded demo check-in.',
                sourceSessionKey: 'checkin_seed_1',
            });
            const seededEntry = await stageTmpMemory({
                type: 'project',
                name: 'Sunday reset: demo',
                description: 'Thread hint general. demo',
                body: '## Current Stage\nSeeded demo entry.',
                sourceSessionKey: 'entry_seed_1',
            });
            const realEntry = await stageTmpMemory({
                type: 'project',
                name: 'Real thread',
                description: 'Thread hint general. real',
                body: '## Current Stage\nA real journal entry.',
                sourceSessionKey: 'entry_real_1',
            });

            const removed = await deleteMemoryFilesBySourceSessions(['checkin_seed_1', 'entry_seed_1']);

            expect(removed).toBe(2);
            const remaining = await listMemoryFiles({ limit: 50 });
            expect(remaining.map((h) => h.id)).toEqual([realEntry.id]);
            // Bodies follow the headers — no orphan left behind.
            expect(await getMemoryRecordsByIds([seededCheckIn.id, seededEntry.id])).toHaveLength(0);
            expect(await getMemoryRecordsByIds([realEntry.id])).toHaveLength(1);
        } finally {
            resetMemoryFilesStorageAdapter();
        }
    });
    it('orders the staged backlog by capture date then id, never by manifest key order', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            // Same capture instant: the only thing left to order by is the id.
            const sameInstant = '2026-09-01T09:00:00.000Z';
            for (const name of ['Gamma', 'Alpha', 'Beta']) {
                await stageTmpMemory({
                    type: 'project',
                    name,
                    description: `Thread hint workload. ${name} backlog item.`,
                    body: `## Current Stage\n${name} backlog body.`,
                    capturedAt: sameInstant,
                });
            }

            const first = await listTmpFiles();
            expect(first).toHaveLength(3);
            expect([...first].map((h) => h.id)).toEqual(first.map((h) => h.id));
            // Tie-break is the id, so the order is alphabetical by slug, not by
            // the order the files happened to be staged in.
            expect(first.map((h) => h.name)).toEqual(['Alpha', 'Beta', 'Gamma']);

            // Rewrite the manifest with its keys reversed. Ordering must not move.
            const raw = adapter.store.get(MEMORY_FILES_MANIFEST_KEY);
            expect(raw).toBeDefined();
            const manifest = JSON.parse(raw as string) as Record<string, unknown>;
            const reversed: Record<string, unknown> = {};
            Object.keys(manifest).reverse().forEach((key) => {
                reversed[key] = manifest[key];
            });
            adapter.store.set(MEMORY_FILES_MANIFEST_KEY, JSON.stringify(reversed));

            expect((await listTmpFiles()).map((h) => h.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });

    it('keeps capture order across promotion even though promotion rewrites updatedAt', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            const ids: string[] = [];
            for (const [index, name] of ['Oldest', 'Middle', 'Newest'].entries()) {
                const staged = await stageTmpMemory({
                    type: 'project',
                    name,
                    description: `Thread hint workload. ${name} backlog item.`,
                    body: `## Current Stage\n${name} backlog body.`,
                    capturedAt: `2026-09-0${index + 1}T09:00:00.000Z`,
                });
                ids.push(staged.id);
            }

            for (const id of ids) {
                expect(await promoteTmpRecord(id, 'workload')).not.toBeNull();
            }

            // Recency reads the capture date, so promotion cannot promote a file
            // into looking like the newest memory in the store.
            const promoted = await listMemoryFiles({ projectId: 'workload', limit: 10 });
            expect(promoted.map((h) => h.name)).toEqual(['Newest', 'Middle', 'Oldest']);
            // Every updatedAt was rewritten to promotion time, yet the order still
            // follows the capture date. That is the property being pinned.
            promoted.forEach((h) => {
                expect(Date.parse(h.updatedAt)).toBeGreaterThan(Date.parse(h.capturedAt ?? ''));
            });
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });
});
