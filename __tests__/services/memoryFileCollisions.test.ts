/**
 * R2.5 — deterministic id collisions in the memory file store.
 *
 * `stageTmpMemory` and `promoteTmpRecord` both derive an id from header fields
 * plus only the **first 400 body characters**, then assign it outright
 * (`manifest[id] = header`). Two distinct memories that agree on all of those
 * compute the *same* id every time, so this was never the rare 32-bit hash
 * collision the earlier finding assumed — it is deterministic, and the second
 * write destroyed the first with nothing in the return value to say so.
 *
 * Proven before the fix: two distinct bodies, one file left in the store, the
 * first memory unreachable.
 */
import {
    clearMemoryFiles,
    getMemoryRecordsByIds,
    listMemoryFiles,
    promoteTmpRecord,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
    stageTmpMemory,
} from '../../services/memory/memoryFiles';

function createAdapter() {
    const store = new Map<string, string>();
    return {
        getItem: async (key: string) => store.get(key) ?? null,
        setItem: async (key: string, value: string) => {
            store.set(key, value);
        },
        removeItem: async (key: string) => {
            store.delete(key);
        },
    };
}

/** Long enough that the two bodies agree on the 400 characters the id hashes. */
const PREFIX = 'x'.repeat(400);

describe('memoryFiles id collisions (R2.5)', () => {
    beforeEach(() => {
        setMemoryFilesStorageAdapter(createAdapter());
    });

    afterEach(async () => {
        await clearMemoryFiles();
        resetMemoryFilesStorageAdapter();
    });

    it('keeps both memories when a stage would collide on the base id', async () => {
        const first = await stageTmpMemory({
            type: 'project',
            name: 'Kiln: Untitled Entry',
            description: 'Thread hint kiln. Same insight text.',
            body: `${PREFIX}\n\n## Notes\nFIRST memory, the glaze cracked.`,
        });
        const second = await stageTmpMemory({
            type: 'project',
            name: 'Kiln: Untitled Entry',
            description: 'Thread hint kiln. Same insight text.',
            body: `${PREFIX}\n\n## Notes\nSECOND memory, a different day entirely.`,
        });

        expect(second.id).not.toBe(first.id);
        const headers = await listMemoryFiles({ limit: 50 });
        expect(headers).toHaveLength(2);

        const live = await getMemoryRecordsByIds(headers.map((h) => h.id));
        expect(live.some((r) => r.content.includes('FIRST memory'))).toBe(true);
        expect(live.some((r) => r.content.includes('SECOND memory'))).toBe(true);
    });

    it('reuses the id when the same memory is staged again', async () => {
        const body = `${PREFIX}\n\n## Notes\nThe same memory, staged twice.`;
        const first = await stageTmpMemory({
            type: 'project', name: 'Kiln: Entry', description: 'Thread hint kiln.', body,
        });
        const again = await stageTmpMemory({
            type: 'project', name: 'Kiln: Entry', description: 'Thread hint kiln.', body,
        });

        // Idempotent, not accumulating — the guard must not turn a re-stage into a
        // second copy of the same memory.
        expect(again.id).toBe(first.id);
        expect(await listMemoryFiles({ limit: 50 })).toHaveLength(1);
    });

    it('keeps both memories when promotion would collide on the base id', async () => {
        const alpha = await stageTmpMemory({
            type: 'project',
            name: 'Lens Restoration',
            description: 'Thread hint lighthouse.',
            body: `${PREFIX}\n\n## Notes\nALPHA promoted memory.`,
        });
        const beta = await stageTmpMemory({
            type: 'project',
            name: 'Lens Restoration',
            description: 'Thread hint lighthouse.',
            body: `${PREFIX}\n\n## Notes\nBETA promoted memory, distinct.`,
        });

        const promotedAlpha = await promoteTmpRecord(alpha.id, 'lighthouse');
        const promotedBeta = await promoteTmpRecord(beta.id, 'lighthouse');
        expect(promotedAlpha).not.toBeNull();
        expect(promotedBeta).not.toBeNull();
        expect(promotedBeta?.id).not.toBe(promotedAlpha?.id);

        const live = await getMemoryRecordsByIds([
            (promotedAlpha as { id: string }).id,
            (promotedBeta as { id: string }).id,
        ]);
        expect(live).toHaveLength(2);
        expect(live.some((r) => r.content.includes('ALPHA'))).toBe(true);
        expect(live.some((r) => r.content.includes('BETA'))).toBe(true);
    });

    it('leaves an already-unique id alone — the base id is tried first', async () => {
        const staged = await stageTmpMemory({
            type: 'project', name: 'Promotion Plan', description: 'Holiday campaign stage',
            body: '## Current Stage\nPlanning holiday push',
        });
        // The guard must not rewrite ids that are already unique, or every existing
        // store would churn — and every id already handed out would dangle — on the
        // next write.
        expect(staged.id).toMatch(/^projects\/_tmp\/Project\/promotion-plan-[a-z0-9]+\.md$/);
        expect(staged.id).not.toContain('-overflow');
    });
});
