import {
    MIRROR_OUTBOX_STORAGE_KEY,
    clearMirrorOutbox,
    isMirrorQuarantineActive,
    resetMirrorOutboxStorageAdapter,
    setMirrorOutboxStorageAdapter,
} from '@/services/memory/cloud/mirrorOutbox';
import {
    clearDatasetBinding,
    getDatasetBinding,
    reconcileDatasetBinding,
    resetDatasetBindingStorageAdapter,
    setDatasetBindingStorageAdapter,
    bindDataset,
    markDatasetEnrolled,
} from '@/services/memory/cloud/datasetBinding';
import {
    egressAllowedFor,
    getMirrorStatus,
    resetMirrorStatusWiring,
    setMirrorConsent,
    subscribeMirrorStatus,
} from '@/services/memory/cloud/mirrorStatus';

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

/** Serialized primary binding envelope for a given owner (phase 'complete'). */
function bindingSeed(ownerId: string): string {
    return JSON.stringify({
        bindingSchemaVersion: 1,
        replicaWritePhase: 'complete',
        localDatasetId: `dset-${ownerId}`,
        ownerId,
        serverDatasetId: null,
        greatestKnownGeneration: 0,
        enrolledAt: null,
        recovery: { required: false, reason: null, since: null },
        createdAt: '2026-08-02T00:00:00.000Z',
        updatedAt: '2026-08-02T00:00:00.000Z',
    });
}

describe('dataset binding and mirror status', () => {
    let outboxAdapter: ReturnType<typeof createMemoryAdapter>;
    let bindingAdapter: ReturnType<typeof createMemoryAdapter>;
    const session = { signedIn: true, allowlisted: true, datasetNonEmpty: true };

    beforeEach(() => {
        outboxAdapter = createMemoryAdapter();
        bindingAdapter = createMemoryAdapter();
        setMirrorOutboxStorageAdapter(outboxAdapter);
        setDatasetBindingStorageAdapter(bindingAdapter);
    });

    afterEach(async () => {
        await clearDatasetBinding();
        await clearMirrorOutbox();
        resetDatasetBindingStorageAdapter();
        resetMirrorOutboxStorageAdapter();
        resetMirrorStatusWiring();
    });

    it('never rebinds a nonempty dataset to a different owner', async () => {
        const bound = await bindDataset({ ownerId: 'A', localDatasetId: 'dset-A', datasetNonEmpty: true });
        expect(bound.status).toBe('bound');

        const mismatch = await bindDataset({ ownerId: 'B', localDatasetId: 'dset-B', datasetNonEmpty: true });
        expect(mismatch.status).toBe('owner_mismatch');
        if (mismatch.status === 'owner_mismatch') expect(mismatch.existingOwnerId).toBe('A');

        expect((await getDatasetBinding())?.ownerId).toBe('A');
        expect((await getDatasetBinding())?.localDatasetId).toBe('dset-A');
    });

    it('a corrupt/missing outbox cannot rebind a nonempty dataset and interrupted replicas recover for A only', async () => {
        const bound = await bindDataset({ ownerId: 'A', localDatasetId: 'dset-A', datasetNonEmpty: true });
        expect(bound.status).toBe('bound');

        // Corrupt the outbox replica; the primary binding survives.
        outboxAdapter.store.set(MIRROR_OUTBOX_STORAGE_KEY, '{corrupt outbox');
        const mismatch = await bindDataset({ ownerId: 'B', localDatasetId: 'dset-B', datasetNonEmpty: true });
        expect(mismatch.status).toBe('owner_mismatch');
        expect((await getDatasetBinding())?.ownerId).toBe('A');

        // Interrupted replica write: primary stuck in replicating with a matching outbox replica.
        bindingAdapter.store.set('@rosebud_memory_dataset_binding', JSON.stringify({
            bindingSchemaVersion: 1,
            replicaWritePhase: 'replicating',
            localDatasetId: 'dset-A',
            ownerId: 'A',
            serverDatasetId: null,
            greatestKnownGeneration: 0,
            enrolledAt: null,
            recovery: { required: false, reason: null, since: null },
            createdAt: '2026-08-02T00:00:00.000Z',
            updatedAt: '2026-08-02T00:00:00.000Z',
        }));
        outboxAdapter.store.delete(MIRROR_OUTBOX_STORAGE_KEY);

        const recovered = await reconcileDatasetBinding({
            datasetNonEmpty: true,
            currentSessionOwnerId: 'A',
            serverVerifiedOwnerId: 'A',
        });
        expect(recovered.status).toBe('repaired');
        expect((await getDatasetBinding())?.replicaWritePhase).toBe('complete');
        expect(outboxAdapter.store.get(MIRROR_OUTBOX_STORAGE_KEY)).not.toBeNull();

        // Server verification is required to reconstruct a missing replica: B cannot.
        bindingAdapter.store.set('@rosebud_memory_dataset_binding', JSON.stringify({
            bindingSchemaVersion: 1,
            replicaWritePhase: 'complete',
            localDatasetId: 'dset-A',
            ownerId: 'A',
            serverDatasetId: null,
            greatestKnownGeneration: 0,
            enrolledAt: null,
            recovery: { required: false, reason: null, since: null },
            createdAt: '2026-08-02T00:00:00.000Z',
            updatedAt: '2026-08-02T00:00:00.000Z',
        }));
        outboxAdapter.store.set(MIRROR_OUTBOX_STORAGE_KEY, '{corrupt again');

        const foreignAttempt = await reconcileDatasetBinding({
            datasetNonEmpty: true,
            currentSessionOwnerId: 'B',
            serverVerifiedOwnerId: null,
        });
        expect(foreignAttempt.status).toBe('requires_original_owner');
        if (foreignAttempt.status === 'requires_original_owner') expect(foreignAttempt.ownerId).toBe('A');
    });

    it('fails closed as binding_recovery_required on conflicting or all-lost commitments', async () => {
        // Conflicting commitments: primary owner A, surviving outbox replica owner B.
        outboxAdapter.store.set(MIRROR_OUTBOX_STORAGE_KEY, JSON.stringify({
            schemaVersion: 2,
            bindingCommitment: {
                bindingSchemaVersion: 1,
                localDatasetId: 'dset-B',
                ownerId: 'B',
                serverDatasetId: null,
                greatestKnownGeneration: 0,
                enrolledAt: null,
            },
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
            authState: {
                refreshAttempts: 0,
                suspended: false,
                suspendedCode: null,
                suspendedAt: null,
            },
            quarantine: null,
        }));
        bindingAdapter.store.set('@rosebud_memory_dataset_binding', JSON.stringify({
            bindingSchemaVersion: 1,
            replicaWritePhase: 'complete',
            localDatasetId: 'dset-A',
            ownerId: 'A',
            serverDatasetId: null,
            greatestKnownGeneration: 0,
            enrolledAt: null,
            recovery: { required: false, reason: null, since: null },
            createdAt: '2026-08-02T00:00:00.000Z',
            updatedAt: '2026-08-02T00:00:00.000Z',
        }));

        const conflicting = await reconcileDatasetBinding({
            datasetNonEmpty: true,
            currentSessionOwnerId: 'B',
            serverVerifiedOwnerId: null,
        });
        expect(conflicting.status).toBe('binding_recovery_required');
        const rebind = await bindDataset({ ownerId: 'C', localDatasetId: 'dset-C', datasetNonEmpty: true });
        expect(rebind.status).toBe('binding_recovery_required');

        // All-lost: no primary, no replica, but sources exist.
        outboxAdapter.store.clear();
        bindingAdapter.store.clear();
        const allLost = await reconcileDatasetBinding({
            datasetNonEmpty: true,
            currentSessionOwnerId: 'C',
            serverVerifiedOwnerId: null,
        });
        expect(allLost.status).toBe('binding_recovery_required');
    });

    it('consent defaults off and gates sourceCopy egress; revocation keeps privacy safety', async () => {
        const before = await getMirrorStatus(session);
        expect(before.consentGranted).toBe(false);
        expect(await egressAllowedFor('sourceCopy', session)).toBe(false);
        expect(await egressAllowedFor('privacySafety', session)).toBe(false);

        const bound = await bindDataset({ ownerId: 'A', localDatasetId: 'dset-A', datasetNonEmpty: true });
        expect(bound.status).toBe('bound');

        const granted = await setMirrorConsent(true, { ownerId: 'A', localDatasetId: 'dset-A' });
        expect(granted.applied).toBe(true);
        expect(await egressAllowedFor('sourceCopy', session)).toBe(true);

        const revoked = await setMirrorConsent(false, { ownerId: 'A', localDatasetId: 'dset-A' });
        expect(revoked.applied).toBe(true);
        expect(await egressAllowedFor('sourceCopy', session)).toBe(false);
        // Revocation never claims hosted deletion nor clears the local dataset.
        expect((await getDatasetBinding())?.ownerId).toBe('A');

        // An already-enrolled dataset keeps privacy-safety egress after revocation.
        const enrolled = await markDatasetEnrolled({ serverDatasetId: 'server-ds-1' });
        expect(enrolled.status).toBe('enrolled');
        expect(await egressAllowedFor('sourceCopy', session)).toBe(false);
        expect(await egressAllowedFor('privacySafety', session)).toBe(true);

        const status = await getMirrorStatus(session);
        expect(status.datasetEnrolled).toBe(true);
    });

    it('mirror status subscriptions fire on consent changes but not on plain reads', async () => {
        await bindDataset({ ownerId: 'A', localDatasetId: 'dset-A', datasetNonEmpty: true });

        const events: string[] = [];
        const unsubscribe = subscribeMirrorStatus(() => {
            events.push('status');
        });

        await getMirrorStatus(session);
        expect(events).toEqual([]);

        await setMirrorConsent(true, { ownerId: 'A', localDatasetId: 'dset-A' });
        expect(events).toEqual(['status']);

        unsubscribe();
        await setMirrorConsent(false, { ownerId: 'A', localDatasetId: 'dset-A' });
        expect(events).toEqual(['status']);
    });

    it('reports outbox_recovery_required when replica repair is blocked by a quarantined outbox', async () => {
        // Bound nonempty dataset for A with a matching server-verified owner, but
        // the outbox payload is corrupt: replica repair's setBindingReplica write
        // is quarantined, so this must NOT be presented as an ownership problem.
        bindingAdapter.store.set('@rosebud_memory_dataset_binding', bindingSeed('A'));
        outboxAdapter.store.set(MIRROR_OUTBOX_STORAGE_KEY, '{corrupt outbox');

        const result = await reconcileDatasetBinding({
            datasetNonEmpty: true,
            currentSessionOwnerId: 'A',
            serverVerifiedOwnerId: 'A',
        });
        expect(result.status).toBe('outbox_recovery_required');
        if (result.status === 'outbox_recovery_required') expect(result.ownerId).toBe('A');
    });

    it('a binding-level clear never rewrites a quarantined outbox and preserves the quarantine', async () => {
        bindingAdapter.store.set('@rosebud_memory_dataset_binding', bindingSeed('A'));
        outboxAdapter.store.set(MIRROR_OUTBOX_STORAGE_KEY, '{corrupt outbox');

        await clearDatasetBinding();

        // Primary binding cleared; the quarantined outbox is NOT touched:
        // setBindingReplica(null) is a documented fail-closed no-op while the
        // corrupt latch holds, so the clear cannot peel the quarantine or smuggle
        // a fresh unverified replica into the envelope.
        expect(bindingAdapter.store.get('@rosebud_memory_dataset_binding')).toBeUndefined();
        expect(outboxAdapter.store.get(MIRROR_OUTBOX_STORAGE_KEY)).toBe('{corrupt outbox');
        expect(await isMirrorQuarantineActive()).toBe(true);
    });
});
