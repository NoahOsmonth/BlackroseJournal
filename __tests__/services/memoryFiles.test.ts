import {
    clearMemoryFiles,
    deleteMemoryFilesBySourceSessions,
    getMemoryRecordsByIds,
    listFormalProjectIds,
    listMemoryFiles,
    listTmpFiles,
    MEMORY_FILE_BODY_PREFIX,
    MEMORY_FILES_CORRUPT_BACKUP_KEY,
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

    it('warns instead of silently skipping an id whose header has no body', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        try {
            const staged = await stageTmpMemory({
                type: 'project', name: 'Orphan', description: 'd', body: '## Current Stage\nx',
            });
            adapter.store.delete(`${MEMORY_FILE_BODY_PREFIX}${staged.id}`);
            await expect(getMemoryRecordsByIds([staged.id])).resolves.toEqual([]);
            expect(warn).toHaveBeenCalledWith(expect.stringContaining(staged.id));
        } finally {
            warn.mockRestore();
            await clearMemoryFiles();
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

    // ---- Silent-data-loss guard: a corrupt manifest must not vanish. ----
    it.each([
        '{ this is not json',
        'null',
        '123',
        '{"schemaVersion":1,"files":"nope"}',
    ])('preserves an unreadable manifest payload (%s) instead of losing it silently', async (payload) => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        try {
            // A live store, then the payload is corrupted out of band.
            await stageTmpMemory({
                type: 'project', name: 'Survivor', description: 'd', body: '## Current Stage\nkeep me',
            });
            expect(await listMemoryFiles({})).toHaveLength(1);

            adapter.store.set(MEMORY_FILES_MANIFEST_KEY, payload);

            // The reader still degrades to empty rather than throwing…
            await expect(listMemoryFiles({})).resolves.toEqual([]);
            // …but the loss is now recoverable and loud.
            expect(adapter.store.get(MEMORY_FILES_CORRUPT_BACKUP_KEY)).toBe(payload);
            expect(adapter.store.has(MEMORY_FILES_MANIFEST_KEY)).toBe(false);
            expect(warn).toHaveBeenCalledWith(expect.stringContaining(MEMORY_FILES_CORRUPT_BACKUP_KEY));
        } finally {
            warn.mockRestore();
            resetMemoryFilesStorageAdapter();
        }
    });

    // ---- CJK threads: normalizeProjectId must keep CJK like the slug helpers. ----
    it('promotes a CJK project id and round-trips it through listFormalProjectIds', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            const staged = await stageTmpMemory({
                type: 'project',
                name: '工作压力',
                description: '压力很大，睡不好。',
                body: '## Current Stage\n工作压力持续了一段时间。',
            });
            expect(staged.projectId).toBe('_tmp');

            const promoted = await promoteTmpRecord(staged.id, '工作压力');
            expect(promoted).not.toBeNull();
            expect(promoted?.projectId).toBe('工作压力');
            expect(promoted?.id).toContain('projects/工作压力/');

            // The round-trip the defect broke: promote -> listFormalProjectIds.
            expect(await listFormalProjectIds()).toEqual(['工作压力']);
            // And the thread is addressable by its own id.
            expect((await listMemoryFiles({ projectId: '工作压力' })).map((h) => h.name)).toEqual(['工作压力']);
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });

    it('keeps a CJK project id when staging directly into it', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            const staged = await stageTmpMemory({
                type: 'project',
                name: '直接归档',
                description: '直接写入正式线索',
                body: '## Current Stage\n直接归档到正式线程。',
                projectId: '工作压力',
            });
            expect(staged.projectId).toBe('工作压力');
            expect(staged.id).toContain('projects/工作压力/');
            expect(await listFormalProjectIds()).toEqual(['工作压力']);
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });

    it('normalizes every already-stored ASCII project id to itself (no thread changes meaning)', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            // Ids exactly as the previous [a-z0-9_-] normalization would have
            // written them — the class of ids a live store already holds.
            const storedIds = ['workload', 'my-thread_2', 'deadlines'];
            const files: Record<string, unknown> = {};
            storedIds.forEach((projectId) => {
                const id = `projects/${projectId}/Project/x.md`;
                files[id] = {
                    id,
                    relativePath: id,
                    name: 'Existing',
                    description: 'existing thread',
                    type: 'project',
                    scope: 'project',
                    projectId,
                    updatedAt: '2026-09-01T00:00:00.000Z',
                };
            });
            adapter.store.set(MEMORY_FILES_MANIFEST_KEY, JSON.stringify({ schemaVersion: 1, files }));

            expect(await listFormalProjectIds()).toEqual(['deadlines', 'my-thread_2', 'workload']);
            for (const projectId of storedIds) {
                // The exact stored spelling must still resolve — if the new
                // normalization altered any of these, the filter would miss.
                const headers = await listMemoryFiles({ projectId });
                expect(headers.map((h) => h.projectId)).toEqual([projectId]);
            }
        } finally {
            resetMemoryFilesStorageAdapter();
        }
    });
});
