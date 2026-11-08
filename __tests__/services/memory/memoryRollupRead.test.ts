import {
    listWeeklyRollupRead,
    resetMemoryRollupStorageAdapter,
    setMemoryRollupStorageAdapter,
} from '@/services/memory/memoryRollupStorage';

const store = new Map<string, string>();

function useAdapter(overrides: Partial<Record<'getItem' | 'setItem' | 'removeItem', unknown>> = {}) {
    setMemoryRollupStorageAdapter({
        getItem: async (key: string) => store.get(key) ?? null,
        setItem: async (key: string, value: string) => { store.set(key, value); },
        removeItem: async (key: string) => { store.delete(key); },
        ...overrides,
    } as never);
}

const weekRow = (periodKey: string) => JSON.stringify({
    schemaVersion: 1,
    kind: 'week',
    periodKey,
    dateFrom: '2026-10-01',
    dateTo: '2026-10-07',
    summary: 'x',
    topics: ['sleep'],
    sourceCount: 2,
    createdAt: 1,
    updatedAt: 1,
});

describe('listWeeklyRollupRead', () => {
    beforeEach(() => {
        store.clear();
        useAdapter();
    });

    afterEach(() => {
        resetMemoryRollupStorageAdapter();
    });

    it('reports empty when nothing has been written yet', async () => {
        const result = await listWeeklyRollupRead();
        expect(result.status).toBe('empty');
        expect(result.rollups).toEqual([]);
    });

    it('reports unreadable when storage throws — not empty', async () => {
        useAdapter({ getItem: async () => { throw new Error('storage offline'); } });
        const result = await listWeeklyRollupRead();
        expect(result.status).toBe('unreadable');
    });

    it('reports unreadable when the stored index is damaged', async () => {
        store.set('@rosebud_memory_rollup_index', '{not json');
        const result = await listWeeklyRollupRead();
        expect(result.status).toBe('unreadable');
    });

    it('reports unreadable when the index has the wrong shape', async () => {
        store.set('@rosebud_memory_rollup_index', JSON.stringify({ nope: true }));
        expect((await listWeeklyRollupRead()).status).toBe('unreadable');
    });

    it('returns the weeks and reports ok when data is valid', async () => {
        store.set('@rosebud_memory_rollup_index', JSON.stringify({
            schemaVersion: 1,
            entries: [{
                id: 'week:2026-W40',
                kind: 'week',
                periodKey: '2026-W40',
                dateFrom: '2026-10-01',
                dateTo: '2026-10-07',
                updatedAt: 1,
            }],
        }));
        store.set('@rosebud_memory_rollup:week:2026-W40', weekRow('2026-W40'));
        const result = await listWeeklyRollupRead();
        expect(result.status).toBe('ok');
        expect(result.rollups).toHaveLength(1);
        expect(result.rollups[0].topics).toEqual(['sleep']);
    });

    it('ignores month entries so only weeks come back', async () => {
        store.set('@rosebud_memory_rollup_index', JSON.stringify({
            schemaVersion: 1,
            entries: [
                { id: 'month:2026-10', kind: 'month', periodKey: '2026-10', dateFrom: '2026-10-01', dateTo: '2026-10-31', updatedAt: 1 },
                { id: 'week:2026-W40', kind: 'week', periodKey: '2026-W40', dateFrom: '2026-10-01', dateTo: '2026-10-07', updatedAt: 1 },
            ],
        }));
        store.set('@rosebud_memory_rollup:week:2026-W40', weekRow('2026-W40'));
        const result = await listWeeklyRollupRead();
        expect(result.rollups).toHaveLength(1);
        expect(result.rollups[0].kind).toBe('week');
    });
});
