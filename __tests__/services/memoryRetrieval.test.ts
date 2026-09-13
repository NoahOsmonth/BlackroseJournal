import {
    clearMemoryRecallCache,
    RECALL_FILE_MAX_CHARS,
    retrieveMemory,
} from '../../services/memory/memoryRetrieval';
import {
    clearMemoryFiles,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
    stageTmpMemory,
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
});
