import {
    clearMemoryRecallCache,
    RECALL_FILE_MAX_CHARS,
    retrieveMemory,
} from '../../services/memory/memoryRetrieval';
import {
    clearMemoryFiles,
    importMemoryFiles,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
    stageTmpMemory,
    stageUserNoteMemory,
} from '../../services/memory/memoryFiles';

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

describe('memoryRetrieval (gated lexical recall)', () => {
    beforeEach(() => {
        setMemoryFilesStorageAdapter(createAdapter());
        clearMemoryRecallCache();
    });

    afterEach(async () => {
        await clearMemoryFiles();
        resetMemoryFilesStorageAdapter();
    });

    it('short-circuits greetings with route=none and empty context', async () => {
        await stageTmpMemory({
            type: 'project', name: 'Work', description: 'deadlines', body: '## Current Stage\nBusy',
            projectId: 'work',
        });
        const result = await retrieveMemory('hi');
        expect(result.intent).toBe('none');
        expect(result.context).toBe('');
        expect(result.debug.mode).toBe('none');
    });

    it('routes identity queries to user files', async () => {
        const result = await retrieveMemory('what is my name?');
        expect(result.intent).toBe('user');
    });

    it('resolves a thread from a 3-letter word through the shared tokenizer', async () => {
        // Regression guard for the drift bug: the capsule/session path used a
        // `> 3` floor while this path used `>= 3`, so 'job' (3) was invisible to
        // one side. Both now tokenize through keywordRanking.tokenize.
        await stageTmpMemory({
            type: 'project', name: 'Job Hunt', description: 'job applications and interviews',
            body: '## Current Stage\nApplied to three roles', projectId: 'job_hunt',
        });
        const result = await retrieveMemory('job update');
        expect(result.intent).toBe('project_memory');
        expect(result.debug.resolvedProjectId).toBe('job_hunt');
        expect(result.context).toContain('Applied to three roles');
    });

    it('resolves an exact thread mention to that project', async () => {
        await stageTmpMemory({
            type: 'project', name: 'Promotion Plan', description: 'holiday campaign stage',
            body: '## Current Stage\nPlanning', projectId: 'promo_plan',
        });
        await stageTmpMemory({
            type: 'project', name: 'Gym Routine', description: 'strength training',
            body: '## Current Stage\nLifting', projectId: 'gym_routine',
        });
        const result = await retrieveMemory('any feedback on the promo plan?');
        expect(result.intent).toBe('project_memory');
        expect(result.debug.resolvedProjectId).toBe('promo_plan');
        expect(result.context).toContain('route=project_memory');
    });

    it('enforces the per-file recall budget on huge bodies', async () => {
        const huge = `## Current Stage\n${'x'.repeat(RECALL_FILE_MAX_CHARS + 5000)}`;
        await stageTmpMemory({
            type: 'project', name: 'Big Thread', description: 'big thread memory',
            body: huge, projectId: 'big_thread',
        });
        const result = await retrieveMemory('big thread memory');
        expect(result.context).toContain('[truncated for recall budget]');
        expect(result.context.length).toBeLessThan(RECALL_FILE_MAX_CHARS + 2000);
    });

    it('serves the second identical query from cache', async () => {
        await stageTmpMemory({
            type: 'project', name: 'Work', description: 'deadlines', body: '## Current Stage\nBusy',
            projectId: 'work',
        });
        const first = await retrieveMemory('work deadlines update');
        const second = await retrieveMemory('work deadlines update');
        expect(first.debug.cacheHit).toBe(false);
        expect(second.debug.cacheHit).toBe(true);
        expect(second.context).toBe(first.context);
    });

    it('considers a thread file older than the old fifty-header window', async () => {
        // 60 files in one thread, capture dates pinned so the needle is provably the
        // *oldest* — outside the newest fifty. Thread selection goes through
        // `listFormalProjectIds` (uncapped), but the manifest scan that feeds ranking
        // used to read `listMemoryFiles({ limit: 200 })`, which caps at 50 in the
        // callee: the needle was never a candidate and no return value said so.
        const day = 24 * 60 * 60 * 1000;
        const base = Date.UTC(2026, 0, 1);
        const files = [{
            header: {
                id: 'projects/lighthouse/Project/lens-restoration.md',
                relativePath: 'projects/lighthouse/Project/lens-restoration.md',
                name: 'Lighthouse lens restoration',
                description: 'Lighthouse lens restoration notes and the copper optic.',
                type: 'project' as const,
                scope: 'project' as const,
                projectId: 'lighthouse',
                updatedAt: new Date(base).toISOString(),
                capturedAt: new Date(base).toISOString(),
            },
            content: '## Current Stage\nLighthouse lens restoration: the copper optic is back in the lamp room.',
        }];
        for (let i = 0; i < 59; i += 1) {
            const at = new Date(base + (i + 1) * day).toISOString();
            files.push({
                header: {
                    id: `projects/lighthouse/Project/shelf-note-${i}.md`,
                    relativePath: `projects/lighthouse/Project/shelf-note-${i}.md`,
                    name: `Shelf note ${i}`,
                    description: `Lighthouse shelf inventory entry number ${i}, unrelated to optics.`,
                    type: 'project' as const,
                    scope: 'project' as const,
                    projectId: 'lighthouse',
                    updatedAt: at,
                    capturedAt: at,
                },
                content: `## Current Stage\nShelf inventory ${i}.`,
            });
        }
        await importMemoryFiles(files);

        const result = await retrieveMemory('lighthouse lens restoration');

        expect(result.debug.resolvedProjectId).toBe('lighthouse');
        expect(result.debug.selectedFileIds).toContain('projects/lighthouse/Project/lens-restoration.md');
        expect(result.context).toContain('copper optic');
    });

    it('recalls a _tmp staged note even when a formal thread resolves', async () => {
        // Regression guard: the project_memory branch used to scan only the
        // resolved thread's headers, so a staged `_tmp` note (which belongs to no
        // thread) was reachable only via the recency fallback — which runs only
        // when NO thread resolves. A note the user just kept is exactly what a
        // just-finished entry should be able to recall.
        await stageTmpMemory({
            type: 'project', name: 'Lighthouse Restoration',
            description: 'lighthouse lens and copper optic restoration',
            body: '## Current Stage\nThe lighthouse lens restoration is underway.',
            projectId: 'lighthouse',
        });
        const staged = await stageUserNoteMemory({
            text: 'Staged note: the copper optic came back from the machinist.',
            threadHint: 'lighthouse',
            sourceEntryId: 'entry-1',
        });
        expect(staged.type).toBe('note');
        expect(staged.projectId).toBe('_tmp');

        const result = await retrieveMemory('lighthouse copper optic restoration');

        expect(result.debug.resolvedProjectId).toBe('lighthouse');
        expect(result.debug.selectedFileIds).toContain(staged.id);
        expect(result.context).toContain('copper optic came back from the machinist');
    });

    it('reports thread and staged counts in the manifest trace', async () => {
        await stageTmpMemory({
            type: 'project', name: 'Lighthouse Restoration',
            description: 'lighthouse lens restoration',
            body: '## Current Stage\nLighthouse lens work.',
            projectId: 'lighthouse',
        });
        await stageUserNoteMemory({
            text: 'Lighthouse lens note kept as written.',
            threadHint: 'lighthouse',
            sourceEntryId: 'entry-2',
        });

        const result = await retrieveMemory('lighthouse lens restoration');
        const scanned = result.trace.find((step) => step.step === 'manifest_scanned');
        expect(scanned?.output).toBe('2 header entries (1 thread, 1 staged)');
    });

    it('does not merge an unpromoted _tmp project file into a resolved thread', async () => {
        // PLAN.md item 2 gates staged **notes** only. An unpromoted extracted
        // `project` file is a near-topic distractor until Dream promotes it; it
        // must stay off the thread-resolved path (recency fallback only) or
        // precision collapses (see probes/r2RecallDelta).
        await stageTmpMemory({
            type: 'project', name: 'Lighthouse Restoration',
            description: 'lighthouse lens and copper optic restoration',
            body: '## Current Stage\nThe lighthouse lens restoration is underway.',
            projectId: 'lighthouse',
        });
        const distractor = await stageTmpMemory({
            type: 'project', name: 'Lighthouse distractor',
            description: 'lighthouse copper optic restoration distractor',
            body: '## Current Stage\nDistractor: unrelated copper optic musing.',
        });
        expect(distractor.projectId).toBe('_tmp');

        const result = await retrieveMemory('lighthouse copper optic restoration');

        expect(result.debug.resolvedProjectId).toBe('lighthouse');
        expect(result.debug.selectedFileIds).not.toContain(distractor.id);
        expect(result.context).not.toContain('unrelated copper optic musing');
    });
});
