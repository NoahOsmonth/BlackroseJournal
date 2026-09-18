/**
 * Regression tests for the silent body-load cap.
 *
 * An unnamed `slice(0, 10)` used to live in `getMemoryRecordsByIds`. Callers that
 * had already bounded their own input still received only ten records, and
 * nothing in the return value said so:
 *
 *   - Dream asked for its 20 candidates and got 10 bodies. The other ten arrived
 *     as `''`, all hashed alike, and the per-thread duplicate collapse kept one
 *     of them — so a Dream run promoted 13 files instead of 20, deferring seven
 *     for no reason.
 *   - Supersession asked for up to 50 files in a thread and compared the newest 10.
 *   - Drive backup paginates the manifest "so large file sets export fully", then
 *     threw every page past the first ten away.
 *
 * The cap is gone. These tests pin the behaviour that replaced it: a caller gets
 * what it asked for, and bounding a request is the caller's explicit decision.
 */
import { runMemoryDream } from '../../../services/memory/memoryDream';
import {
    clearMemoryFiles,
    getMemoryRecordsByIds,
    listTmpFiles,
    MEMORY_FILE_BODY_PREFIX,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
    stageTmpMemory,
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

/** Stage `count` distinct memories that all cluster into one thread. */
async function stageThread(count: number, hint = 'workload'): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 1; i <= count; i += 1) {
        const staged = await stageTmpMemory({
            type: 'project',
            name: `Backlog item ${i}`,
            description: `Thread hint ${hint}. Distinct backlog entry number ${i}.`,
            body: `## Current Stage\nBacklog entry ${i} with its own distinct body text.`,
        });
        ids.push(staged.id);
    }
    return ids;
}

describe('memory record body loads (no silent cap)', () => {
    beforeEach(() => {
        setMemoryFilesStorageAdapter(createAdapter());
    });

    afterEach(async () => {
        await clearMemoryFiles();
        resetMemoryFilesStorageAdapter();
    });

    it('returns every requested id when the caller sets no limit', async () => {
        const ids = await stageThread(15);
        const records = await getMemoryRecordsByIds(ids);
        expect(records).toHaveLength(15);
        expect(records.map((r) => r.id).sort()).toEqual([...ids].sort());
        expect(records.every((r) => r.content.length > 0)).toBe(true);
    });

    it('honours an explicit limit when the caller sets one', async () => {
        const ids = await stageThread(15);
        expect(await getMemoryRecordsByIds(ids, { limit: 5 })).toHaveLength(5);
        expect(await getMemoryRecordsByIds(ids, { limit: 0 })).toHaveLength(0);
    });

    it('Dream promotes every readable candidate up to its cap, not ten plus one per thread', async () => {
        await stageThread(20);
        expect(await listTmpFiles()).toHaveLength(20);

        const outcome = await runMemoryDream({ tryLlm: false });

        // With the cap in place this was 11: ten bodies plus one empty-body
        // survivor per thread.
        expect(outcome.promoted).toBe(20);
        expect(outcome.threads).toEqual(['workload']);
        expect(await listTmpFiles()).toHaveLength(0);
    });

    it('never treats a body that failed to load as a duplicate of another file', async () => {
        const inner = createAdapter();
        setMemoryFilesStorageAdapter(inner);
        const staged = await stageThread(2);
        const bodyKeys = new Set(staged.map((id) => `${MEMORY_FILE_BODY_PREFIX}${id}`));

        // Transient miss: the first read of each body returns null, the second
        // succeeds. Dream's bulk load misses both, promotion's own read hits.
        const missed = new Set<string>();
        setMemoryFilesStorageAdapter({
            getItem: jest.fn(async (key: string) => {
                if (bodyKeys.has(key) && !missed.has(key)) {
                    missed.add(key);
                    return null;
                }
                return inner.getItem(key);
            }),
            setItem: inner.setItem,
            removeItem: inner.removeItem,
        });

        const outcome = await runMemoryDream({ tryLlm: false });

        // Both files are unreadable at that moment. Collapsing on the empty body
        // would have dropped one of them as a duplicate of the other.
        expect(missed.size).toBe(2);
        expect(outcome.promoted).toBe(2);
    });
});
