import {
    MIRROR_OUTBOX_SCHEMA_VERSION,
    MIRROR_OUTBOX_STORAGE_KEY,
    acknowledgeDeletion,
    acknowledgeSource,
    clearMirrorOutbox,
    getConsentState,
    getEnvelopeSnapshot,
    importTombstoneIntent,
    markSourceDirty,
    recordMirrorAttempt,
    reportInvalidSource,
    reportMirrorCapacity,
    resetMirrorOutboxCapacity,
    resetMirrorOutboxStorageAdapter,
    resetMirrorSuspension,
    setMirrorOutboxCapacity,
    setMirrorOutboxStorageAdapter,
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

const FORBIDDEN_KEYS = [
    'content', 'contents', 'title', 'summary', 'reasoning', 'analysis',
    'prompt', 'token', 'messages', 'body', 'prose', 'text', 'insight', 'quote',
];

function findForbiddenKeys(value: unknown, path = 'root', out: string[] = []): string[] {
    if (Array.isArray(value)) {
        value.forEach((entry, index) => findForbiddenKeys(entry, `${path}[${index}]`, out));
    } else if (value && typeof value === 'object') {
        Object.entries(value).forEach(([key, entry]) => {
            if (FORBIDDEN_KEYS.includes(key)) out.push(`${path}.${key}`);
            findForbiddenKeys(entry, `${path}.${key}`, out);
        });
    }
    return out;
}

describe('mirrorOutbox persistence', () => {
    let adapter: ReturnType<typeof createMemoryAdapter>;

    beforeEach(() => {
        adapter = createMemoryAdapter();
        setMirrorOutboxStorageAdapter(adapter);
        resetMirrorOutboxCapacity();
    });

    afterEach(async () => {
        await clearMirrorOutbox();
        resetMirrorOutboxStorageAdapter();
    });

    it('ships a schema envelope and migrates a legacy v1 payload to the current version', async () => {
        adapter.store.set(MIRROR_OUTBOX_STORAGE_KEY, JSON.stringify({
            schemaVersion: 1,
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:00:00.000Z',
            bindingCommitment: null,
            consentState: {
                ownerId: null,
                localDatasetId: null,
                granted: false,
                grantedAt: null,
                revokedAt: null,
                consentVersion: 0,
            },
            generation: 0,
            acknowledgedCursors: {},
            pendingSources: {},
            tombstones: {},
        }));

        const snap = await getEnvelopeSnapshot();
        expect(snap.schemaVersion).toBe(MIRROR_OUTBOX_SCHEMA_VERSION);
        expect(snap.authState).toEqual({
            refreshAttempts: 0,
            suspended: false,
            suspendedCode: null,
            suspendedAt: null,
        });

        await markSourceDirty(candidate());
        const stored = JSON.parse(adapter.store.get(MIRROR_OUTBOX_STORAGE_KEY) as string);
        expect(stored.schemaVersion).toBe(MIRROR_OUTBOX_SCHEMA_VERSION);
    });

    it('quarantines unknown future schema versions and fails closed', async () => {
        adapter.store.set(MIRROR_OUTBOX_STORAGE_KEY, JSON.stringify({ schemaVersion: 999 }));

        const snap = await getEnvelopeSnapshot();
        expect(snap.schemaVersion).toBe(MIRROR_OUTBOX_SCHEMA_VERSION);
        expect(snap.pendingSources).toEqual({});
        // Untrusted payload stays at the owned key (no second copy ever) and
        // source mutation is blocked until the outbox is reconciled.
        expect([...adapter.store.keys()]).toEqual([MIRROR_OUTBOX_STORAGE_KEY]);
        expect(await markSourceDirty(candidate())).toMatchObject({ applied: false });
    });

    it('quarantines a corrupt envelope and fails closed without trusting garbage', async () => {
        adapter.store.set(MIRROR_OUTBOX_STORAGE_KEY, '{definitely not json');

        const snap = await getEnvelopeSnapshot();
        expect(snap.schemaVersion).toBe(MIRROR_OUTBOX_SCHEMA_VERSION);
        expect(snap.pendingSources).toEqual({});
        // The owned key alone retains the corrupt bytes (never copied to a
        // backup key); the payload is never trusted for source mutation.
        expect(adapter.store.get(MIRROR_OUTBOX_STORAGE_KEY)).toBe('{definitely not json');
        expect([...adapter.store.keys()]).toEqual([MIRROR_OUTBOX_STORAGE_KEY]);
        expect(await markSourceDirty(candidate())).toMatchObject({ applied: false });
    });

    it('never stores source prose: content fields are structurally impossible and absent', async () => {
        await markSourceDirty(candidate({ sourceRevision: 3, previousAcceptedRevision: 2, messageRevision: 7 }));
        await markSourceDirty(candidate({ sourceId: 'intention_checkin:ci-2', sourceKind: 'intention_checkin' }));
        await importTombstoneIntent({
            sourceId: 'journal:deleted-1',
            sourceKind: 'journal',
            tombstoneRevision: 4,
            deletedAt: '2026-08-02T00:00:00.000Z',
            sinkIds: ['mirror'],
        });

        const raw = adapter.store.get(MIRROR_OUTBOX_STORAGE_KEY) as string;
        expect(raw).not.toContain('Exact user journal text');
        const parsed = JSON.parse(raw);
        expect(findForbiddenKeys(parsed)).toEqual([]);
    });

    it('create plus two edits before first upload keeps only the current canonical revision', async () => {
        await markSourceDirty(candidate({ sourceRevision: 1 }));
        await markSourceDirty(candidate({ sourceRevision: 2, messageRevision: 3 }));
        await markSourceDirty(candidate({ sourceRevision: 3, messageRevision: 4 }));

        const snap = await getEnvelopeSnapshot();
        const ref = snap.pendingSources['journal:entry-1'];
        expect(ref).toBeDefined();
        expect(ref.sourceRevision).toBe(3);
        expect(ref.previousAcceptedRevision).toBeNull();
        expect(ref.messageRevision).toBe(4);
        expect(Object.keys(snap.pendingSources)).toHaveLength(1);

        const raw = adapter.store.get(MIRROR_OUTBOX_STORAGE_KEY) as string;
        expect(raw).toContain('"sourceRevision":3');
        expect(raw).not.toContain('"sourceRevision":1');
    });

    it('two offline edits after MIRROR retain the last accepted cursor and current higher revision', async () => {
        await markSourceDirty(candidate({ sourceRevision: 1 }));
        await acknowledgeSource('journal:entry-1', { acceptedRevision: 1 });

        await markSourceDirty(candidate({ sourceRevision: 2, previousAcceptedRevision: 1 }));
        await markSourceDirty(candidate({ sourceRevision: 3, previousAcceptedRevision: 1 }));

        const ref = (await getEnvelopeSnapshot()).pendingSources['journal:entry-1'];
        expect(ref.sourceRevision).toBe(3);
        expect(ref.previousAcceptedRevision).toBe(1);

        const raw = adapter.store.get(MIRROR_OUTBOX_STORAGE_KEY) as string;
        expect(raw).toContain('"previousAcceptedRevision":1');
        expect(raw).toContain('"sourceRevision":3');
    });

    it('acknowledging a deletion removes only per-sink retry state and keeps the commitment', async () => {
        await importTombstoneIntent({
            sourceId: 'journal:gone-1',
            sourceKind: 'journal',
            tombstoneRevision: 4,
            deletedAt: '2026-08-02T00:00:00.000Z',
            sinkIds: ['mirror'],
        });
        await recordMirrorAttempt(
            { kind: 'tombstone', sourceId: 'journal:gone-1', sinkId: 'mirror' },
            'TRANSIENT',
            0,
        );

        const before = (await getEnvelopeSnapshot()).tombstones['journal:gone-1'];
        expect(before.sinkStates.mirror.attempts).toBe(1);

        const ack = await acknowledgeDeletion('journal:gone-1', 'mirror');
        expect(ack.ok).toBe(true);
        expect(ack.acknowledged).toBe(true);

        const snap = await getEnvelopeSnapshot();
        expect(snap.tombstones['journal:gone-1']).toBeDefined();
        expect(snap.tombstones['journal:gone-1'].acknowledged).toBe(true);
        expect(snap.tombstones['journal:gone-1'].sinkStates).toEqual({});

        const raw = adapter.store.get(MIRROR_OUTBOX_STORAGE_KEY) as string;
        expect(raw).not.toContain('"attempts":1');
    });

    it('reports blocked capacity without ever evicting the oldest item', async () => {
        setMirrorOutboxCapacity({ maxPendingSources: 3, maxPendingTombstones: 4096 });

        await markSourceDirty(candidate({ sourceId: 'journal:s1' }));
        await markSourceDirty(candidate({ sourceId: 'journal:s2' }));
        await markSourceDirty(candidate({ sourceId: 'journal:s3' }));

        expect((await reportMirrorCapacity()).blocked).toBe(false);

        await markSourceDirty(candidate({ sourceId: 'journal:s4' }));

        const report = await reportMirrorCapacity();
        expect(report.blocked).toBe(true);
        expect(report.nothingEvicted).toBe(true);

        const snap = await getEnvelopeSnapshot();
        expect(Object.keys(snap.pendingSources)).toHaveLength(4);
        expect(snap.pendingSources['journal:s1']).toBeDefined();
        expect(snap.pendingSources['journal:s4'].blockedReason).toBe('capacity');

        const coalesce = await markSourceDirty(candidate({ sourceId: 'journal:s1', sourceRevision: 2 }));
        expect(coalesce.applied).toBe(true);
    });

    it('consent state defaults off and is visible through the envelope', async () => {
        const consent = await getConsentState();
        expect(consent.granted).toBe(false);
        expect(consent.ownerId).toBeNull();
    });

    it('blocks invalid source content with a redacted diagnostic and retains the source', async () => {
        await markSourceDirty(candidate({ sourceRevision: 1 }));
        const result = await reportInvalidSource(candidate({ sourceRevision: 1 }), 'INVALID_NUL');
        expect(result.applied).toBe(true);

        const snapshot = await getEnvelopeSnapshot();
        const reference = snapshot.pendingSources['journal:entry-1'];
        expect(reference.blockedReason).toBe('invalid_source');
        expect(reference.lastErrorCode).toBe('INVALID_NUL');
        expect(reference.sourceId).toBe('journal:entry-1');

        const raw = adapter.store.get(MIRROR_OUTBOX_STORAGE_KEY) as string;
        expect(raw).not.toContain('Exact invalid source text');
        expect(raw).not.toContain('INVALID_NUL: do not echo this content');
    });

    it('suspends on auth errors: 401 allows one refresh then suspends, 403 suspends at once', async () => {
        await markSourceDirty(candidate());

        const first = await recordMirrorAttempt({ kind: 'source', sourceId: 'journal:entry-1' }, '401', 1000);
        expect(first.suspended).toBe(false);
        expect((await getEnvelopeSnapshot()).authState.refreshAttempts).toBe(1);

        const second = await recordMirrorAttempt({ kind: 'source', sourceId: 'journal:entry-1' }, '401', 2000);
        expect(second.suspended).toBe(true);
        expect(second.suspensionCode).toBe('401');

        await resetMirrorSuspension();
        const third = await recordMirrorAttempt({ kind: 'source', sourceId: 'journal:entry-1' }, '403', 3000);
        expect(third.suspended).toBe(true);
        expect(third.suspensionCode).toBe('403');
    });

    it('migrates a legacy v1 payload that predates the tombstone ledger', async () => {
        adapter.store.set(MIRROR_OUTBOX_STORAGE_KEY, JSON.stringify({
            schemaVersion: 1,
            generation: 0,
            acknowledgedCursors: {},
            pendingSources: {},
        }));

        const snap = await getEnvelopeSnapshot();
        expect(snap.schemaVersion).toBe(MIRROR_OUTBOX_SCHEMA_VERSION);
        expect(snap.tombstones).toEqual({});
        expect(adapter.store.has(MIRROR_OUTBOX_STORAGE_KEY)).toBe(true);
    });
});
