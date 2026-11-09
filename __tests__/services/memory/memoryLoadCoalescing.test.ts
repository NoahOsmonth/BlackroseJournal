/**
 * Sixteen concurrent reads, one load (Kaneo #101).
 *
 * A cold boot called loadMemoryStore sixteen times inside ~50 ms, and each call
 * read the header plus all eight shards. The bench cannot separate that from the
 * demo seed's own writes, so the guarantee is pinned here as a read count.
 */
import {
    importMemoryAtoms,
    listMemoryAtoms,
    resetMemoryStorageAdapter,
    setMemoryStorageAdapter,
} from '../../../services/memory/localMemory';

function countingAdapter() {
    const rows = new Map<string, string>();
    let reads = 0;
    return {
        adapter: {
            getItem: (k: string) => { reads += 1; return Promise.resolve(rows.get(k) ?? null); },
            setItem: (k: string, v: string) => { rows.set(k, v); return Promise.resolve(); },
            removeItem: (k: string) => { rows.delete(k); return Promise.resolve(); },
        },
        totalReads: () => reads,
        resetReads: () => { reads = 0; },
    };
}

describe('memory store loading', () => {
    afterEach(() => { resetMemoryStorageAdapter(); });

    it('serves sixteen concurrent readers from one load', async () => {
        const { adapter, totalReads, resetReads } = countingAdapter();
        setMemoryStorageAdapter(adapter);
        await importMemoryAtoms([
            { layer: 'note', source: 'manual', sourceId: 'one', rootSourceKind: 'manual', title: 'One', content: 'First atom', tags: [], salience: 0.5, confidence: 1 },
        ]);

        resetReads();
        const results = await Promise.all(Array.from({ length: 16 }, () => listMemoryAtoms()));
        const reads = totalReads();

        expect(results.every((list) => list.length === 1)).toBe(true);
        // One header read plus one shard sweep. Sixteen loads would be 144.
        expect(reads).toBeLessThanOrEqual(10);
    });

    it('re-reads after a write so a saved atom is never invisible', async () => {
        const { adapter } = countingAdapter();
        setMemoryStorageAdapter(adapter);
        await importMemoryAtoms([
            { layer: 'note', source: 'manual', sourceId: 'one', rootSourceKind: 'manual', title: 'One', content: 'First atom', tags: [], salience: 0.5, confidence: 1 },
        ]);
        await importMemoryAtoms([
            { layer: 'note', source: 'manual', sourceId: 'two', rootSourceKind: 'manual', title: 'Two', content: 'Second atom', tags: [], salience: 0.5, confidence: 1 },
        ]);
        const atoms = await listMemoryAtoms();
        expect(atoms.map((atom) => atom.title).sort()).toEqual(['One', 'Two']);
    });
});
