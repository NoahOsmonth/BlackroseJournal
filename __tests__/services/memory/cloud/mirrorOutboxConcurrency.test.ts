import {
    acknowledgeDeletion,
    acknowledgeSource,
    clearMirrorOutbox,
    getEnvelopeSnapshot,
    importTombstoneIntent,
    markSourceDirty,
    reportMirrorCapacity,
    resetMirrorOutboxStorageAdapter,
    selectMirrorWork,
    setMirrorOutboxStorageAdapter,
    subscribeMirrorOutboxChanges,
} from '@/services/memory/cloud/mirrorOutbox';
import type { MarkSourceDirtyInput } from '@/services/memory/cloud/mirrorOutbox.types';

function createMemoryAdapter() {
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

function candidate(overrides: Partial<MarkSourceDirtyInput> = {}): MarkSourceDirtyInput {
    return {
        sourceId: 'journal:entry-1',
        sourceKind: 'journal',
        sourceRevision: 1,
        previousAcceptedRevision: null,
        messageRevision: 1,
        ...overrides,
    };
}

describe('mirrorOutbox concurrency', () => {
    beforeEach(() => {
        setMirrorOutboxStorageAdapter(createMemoryAdapter());
    });

    afterEach(async () => {
        await clearMirrorOutbox();
        resetMirrorOutboxStorageAdapter();
    });

    it('serializes concurrent dirty marks without losing any source', async () => {
        const marks = Array.from({ length: 30 }, (_, index) => (
            markSourceDirty(candidate({ sourceId: `journal:e${index}`, sourceRevision: index + 1 }))
        ));

        const results = await Promise.all(marks);
        expect(results.every((result) => result.applied)).toBe(true);

        const snap = await getEnvelopeSnapshot();
        expect(Object.keys(snap.pendingSources)).toHaveLength(30);
        expect(snap.generation).toBe(30);
    });

    it('coalesces repeated marks for the same source without losing the newest generation', async () => {
        await markSourceDirty(candidate({ sourceRevision: 1 }));
        await markSourceDirty(candidate({ sourceRevision: 2, messageRevision: 2 }));
        await markSourceDirty(candidate({ sourceRevision: 3, messageRevision: 3 }));

        const snap = await getEnvelopeSnapshot();
        expect(Object.keys(snap.pendingSources)).toHaveLength(1);
        const ref = snap.pendingSources['journal:entry-1'];
        expect(ref.sourceRevision).toBe(3);
        expect(ref.messageRevision).toBe(3);
        expect(ref.generation).toBe(snap.generation);
    });

    it('retains the last accepted cursor through coalescing without copying source prose', async () => {
        await markSourceDirty(candidate({ sourceRevision: 1 }));
        await acknowledgeSource('journal:entry-1', { acceptedRevision: 1 });
        await markSourceDirty(candidate({ sourceRevision: 2, previousAcceptedRevision: 1 }));
        await markSourceDirty(candidate({ sourceRevision: 4, previousAcceptedRevision: 1, messageRevision: 5 }));

        const ref = (await getEnvelopeSnapshot()).pendingSources['journal:entry-1'];
        expect(ref.sourceRevision).toBe(4);
        expect(ref.previousAcceptedRevision).toBe(1);

        const raw = JSON.stringify((await getEnvelopeSnapshot()));
        expect(raw).not.toContain('"content"');
        expect(raw).not.toContain('Exact user journal text');
    });

    it('selects tombstones before ordinary source work and never coalesces them away', async () => {
        await importTombstoneIntent({
            sourceId: 'journal:gone-1',
            sourceKind: 'journal',
            tombstoneRevision: 5,
            deletedAt: '2026-08-02T00:00:00.000Z',
            sinkIds: ['mirror'],
        });
        await markSourceDirty(candidate({ sourceId: 'journal:active-1', sourceRevision: 9 }));

        let work = await selectMirrorWork();
        expect(work[0].kind).toBe('tombstone');
        expect(work[0].sourceId).toBe('journal:gone-1');

        await acknowledgeDeletion('journal:gone-1', 'mirror');
        work = await selectMirrorWork();
        expect(work[0].kind).toBe('source');

        // A committed tombstone is never dropped by a racing dirty mark.
        const blocked = await markSourceDirty(candidate({ sourceId: 'journal:gone-1' }));
        expect(blocked.applied).toBe(false);
        if (blocked.applied === false) expect(blocked.reason).toBe('tombstoned');
        expect((await getEnvelopeSnapshot()).tombstones['journal:gone-1']).toBeDefined();
    });

    it('fires subscriptions on meaningful changes but not on access bookkeeping', async () => {
        const events: string[] = [];
        const unsubscribe = subscribeMirrorOutboxChanges(() => {
            events.push('outbox');
        });

        await getEnvelopeSnapshot();
        await reportMirrorCapacity();
        expect(events).toEqual([]);

        await markSourceDirty(candidate());
        expect(events).toEqual(['outbox']);

        await acknowledgeSource('journal:entry-1', { acceptedRevision: 1 });
        expect(events).toEqual(['outbox', 'outbox']);

        unsubscribe();
        await markSourceDirty(candidate());
        expect(events).toEqual(['outbox', 'outbox']);
    });
});
