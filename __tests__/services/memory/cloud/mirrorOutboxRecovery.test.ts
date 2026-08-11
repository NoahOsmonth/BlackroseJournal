import {
    COMPLETION_QUARANTINE_WINDOW_MS,
    MIRROR_OUTBOX_STORAGE_KEY,
    MIRROR_RETRY_BASE_MS,
} from '@/services/memory/cloud/mirrorOutbox';
import type { MarkSourceDirtyInput } from '@/services/memory/cloud/mirrorOutbox.types';

type OutboxModule = typeof import('@/services/memory/cloud/mirrorOutbox');

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

function freshOutbox(adapter: ReturnType<typeof createMemoryAdapter>, now: () => number): OutboxModule {
    jest.resetModules();
    // Simulate a process restart: a fresh module instance reads the same store.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/services/memory/cloud/mirrorOutbox') as OutboxModule;
    mod.setMirrorOutboxStorageAdapter(adapter);
    mod.setMirrorOutboxClock(now);
    mod.setMirrorOutboxRandom(() => 0.5);
    return mod;
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

describe('mirrorOutbox recovery', () => {
    it('restart preserves cursor, backoff, and last verified parity', async () => {
        const adapter = createMemoryAdapter();
        const now = { ms: 1_000_000 };

        const first = freshOutbox(adapter, () => now.ms);
        await first.markSourceDirty(candidate({ sourceRevision: 1 }));
        await first.acknowledgeSource('journal:entry-1', { acceptedRevision: 1 });
        await first.markSourceDirty(candidate({ sourceRevision: 2, previousAcceptedRevision: 1 }));
        await first.recordMirrorAttempt({ kind: 'source', sourceId: 'journal:entry-1' }, 'TRANSIENT', now.ms);
        await first.setVerifiedUnion({
            receipt: 'owner-union:abc',
            sourceSetVersion: 7,
            conversationCount: 1,
            messageCount: 1,
            hash: 'sha256:deadbeef',
            acceptedAt: '2026-08-02T00:00:00.000Z',
        });

        const beforeRestart = await first.getEnvelopeSnapshot();
        expect(beforeRestart.pendingSources['journal:entry-1'].attempts).toBe(1);
        expect(beforeRestart.pendingSources['journal:entry-1'].nextAttemptAt)
            .toBe(now.ms + MIRROR_RETRY_BASE_MS);
        expect(beforeRestart.lastVerifiedUnion?.receipt).toBe('owner-union:abc');

        const second = freshOutbox(adapter, () => now.ms);
        const afterRestart = await second.getEnvelopeSnapshot();
        expect(afterRestart.pendingSources['journal:entry-1'])
            .toEqual(beforeRestart.pendingSources['journal:entry-1']);
        expect(afterRestart.acknowledgedCursors['journal:entry-1'])
            .toEqual(beforeRestart.acknowledgedCursors['journal:entry-1']);
        expect(afterRestart.lastVerifiedUnion).toEqual(beforeRestart.lastVerifiedUnion);
    });

    it('restart preserves an outcome-unknown guard and enforces the fresh quarantine', async () => {
        const adapter = createMemoryAdapter();
        const now = { ms: 2_000_000 };

        const first = freshOutbox(adapter, () => now.ms);
        await first.beginCompletionGuard({
            permitId: 'permit-1',
            manifestId: 'manifest-1',
            generation: 7,
            serverExpiresAt: '2026-08-11T12:00:00.000Z',
        });
        await first.markCompletionOutcomeUnknown();
        const guardBefore = (await first.getEnvelopeSnapshot()).completionGuard;
        expect(guardBefore?.outcomeUnknown).toBe(true);

        const second = freshOutbox(adapter, () => now.ms);
        const guardAfter = (await second.getEnvelopeSnapshot()).completionGuard;
        expect(guardAfter).toEqual(guardBefore);
        expect(await second.isMirrorQuarantineActive()).toBe(true);

        const blocked = await second.markSourceDirty(candidate({ sourceRevision: 8 }));
        expect(blocked.applied).toBe(false);
        if (blocked.applied === false) expect(blocked.reason).toBe('quarantine');

        now.ms += COMPLETION_QUARANTINE_WINDOW_MS + 10;
        expect(await second.isMirrorQuarantineActive()).toBe(false);

        const finalized = await second.finalizeStaleCompletionGuard();
        expect(finalized.ok).toBe(true);
        expect((await second.getEnvelopeSnapshot()).completionGuard).toBeNull();

        const applied = await second.markSourceDirty(candidate({ sourceRevision: 8 }));
        expect(applied.applied).toBe(true);
    });

    it('enforces the full fresh permit quarantine for a corrupt outbox over a nonempty bound dataset', async () => {
        const adapter = createMemoryAdapter();
        const now = { ms: 3_000_000 };
        adapter.store.set(MIRROR_OUTBOX_STORAGE_KEY, '{corrupt outbox bytes');

        const outbox = freshOutbox(adapter, () => now.ms);
        const committed = {
            bindingSchemaVersion: 1,
            localDatasetId: 'dset-A',
            ownerId: 'A',
            serverDatasetId: null,
            greatestKnownGeneration: 0,
            enrolledAt: null,
        };

        const first = await outbox.recoverMirrorOutbox({
            datasetBound: true,
            datasetNonEmpty: true,
            recordedOwnerId: 'A',
            currentSessionOwnerId: 'A',
            serverVerifiedOwnerId: 'A',
            reconstructedCommitment: committed,
        });
        expect(first.status).toBe('quarantined');
        expect(adapter.store.get(MIRROR_OUTBOX_STORAGE_KEY)).toBe('{corrupt outbox bytes');
        expect(await outbox.isMirrorQuarantineActive()).toBe(true);

        const blocked = await outbox.markSourceDirty(candidate());
        expect(blocked.applied).toBe(false);
        if (blocked.applied === false) expect(blocked.reason).toBe('quarantine');

        now.ms += COMPLETION_QUARANTINE_WINDOW_MS + 10;

        const second = await outbox.recoverMirrorOutbox({
            datasetBound: true,
            datasetNonEmpty: true,
            recordedOwnerId: 'A',
            currentSessionOwnerId: 'A',
            serverVerifiedOwnerId: 'A',
            reconstructedCommitment: committed,
        });
        expect(second.status).toBe('recovered');
        if (second.status === 'recovered') expect(second.ownerId).toBe('A');

        const applied = await outbox.markSourceDirty(candidate());
        expect(applied.applied).toBe(true);
    });

    it('a different session owner can never rebuild a quarantined nonempty dataset', async () => {
        const adapter = createMemoryAdapter();
        const now = { ms: 4_000_000 };
        adapter.store.set(MIRROR_OUTBOX_STORAGE_KEY, '{corrupt again');

        const outbox = freshOutbox(adapter, () => now.ms);
        const committed = {
            bindingSchemaVersion: 1,
            localDatasetId: 'dset-A',
            ownerId: 'A',
            serverDatasetId: null,
            greatestKnownGeneration: 0,
            enrolledAt: null,
        };

        await outbox.recoverMirrorOutbox({
            datasetBound: true,
            datasetNonEmpty: true,
            recordedOwnerId: 'A',
            currentSessionOwnerId: 'A',
            serverVerifiedOwnerId: 'A',
            reconstructedCommitment: committed,
        });

        now.ms += COMPLETION_QUARANTINE_WINDOW_MS + 10;

        const attempt = await outbox.recoverMirrorOutbox({
            datasetBound: true,
            datasetNonEmpty: true,
            recordedOwnerId: 'A',
            currentSessionOwnerId: 'B',
            serverVerifiedOwnerId: null,
            reconstructedCommitment: committed,
        });
        expect(attempt.status).toBe('requires_original_owner');
        if (attempt.status === 'requires_original_owner') expect(attempt.ownerId).toBe('A');

        const blocked = await outbox.markSourceDirty(candidate());
        expect(blocked.applied).toBe(false);
        if (blocked.applied === false) expect(blocked.reason).toBe('quarantine');
    });

    it('does not re-arm a fresh quarantine window after a successful recovery', async () => {
        const adapter = createMemoryAdapter();
        const now = { ms: 6_000_000 };
        adapter.store.set(MIRROR_OUTBOX_STORAGE_KEY, '{corrupt outbox bytes');

        const outbox = freshOutbox(adapter, () => now.ms);
        const committed = {
            bindingSchemaVersion: 1,
            localDatasetId: 'dset-A',
            ownerId: 'A',
            serverDatasetId: null,
            greatestKnownGeneration: 0,
            enrolledAt: null,
        };
        const recovery = {
            datasetBound: true,
            datasetNonEmpty: true,
            recordedOwnerId: 'A',
            currentSessionOwnerId: 'A',
            serverVerifiedOwnerId: 'A',
            reconstructedCommitment: committed,
        };

        const first = await outbox.recoverMirrorOutbox(recovery);
        expect(first.status).toBe('quarantined');

        now.ms += COMPLETION_QUARANTINE_WINDOW_MS + 10;
        const second = await outbox.recoverMirrorOutbox(recovery);
        expect(second.status).toBe('recovered');

        // Enough time for a fresh would-be window to elapse: the issuer must NOT
        // re-derive a corrupt-outbox quarantine from the earlier recovery.
        now.ms += COMPLETION_QUARANTINE_WINDOW_MS + 10;
        const third = await outbox.recoverMirrorOutbox(recovery);
        expect(third.status).toBe('ready');
        expect((await outbox.getMirrorQuarantine()).active).toBe(false);
    });

    it('blocks a source mutation until recovery for a corrupt outbox over nonempty data', async () => {
        const adapter = createMemoryAdapter();
        const now = { ms: 7_000_000 };
        adapter.store.set(MIRROR_OUTBOX_STORAGE_KEY, '{corrupt outbox');

        const outbox = freshOutbox(adapter, () => now.ms);

        // The coordinator's startup recovery has not run yet: a source mutation
        // must not silently rebuild the outbox unquarantined.
        const blocked = await outbox.markSourceDirty(candidate());
        expect(blocked.applied).toBe(false);
        if (blocked.applied === false) expect(blocked.reason).toBe('quarantine');
        // The untrusted payload is never rewritten as a valid envelope.
        expect(adapter.store.get(MIRROR_OUTBOX_STORAGE_KEY)).toBe('{corrupt outbox');

        // Recovery still drives the FULL fresh window before the outbox may be
        // rebuilt (the block alone does not shorten the permit quarantine).
        const quarantined = await outbox.recoverMirrorOutbox({
            datasetBound: true,
            datasetNonEmpty: true,
            recordedOwnerId: 'A',
            currentSessionOwnerId: 'A',
            serverVerifiedOwnerId: 'A',
            reconstructedCommitment: {
                bindingSchemaVersion: 1,
                localDatasetId: 'dset-A',
                ownerId: 'A',
                serverDatasetId: null,
                greatestKnownGeneration: 0,
                enrolledAt: null,
            },
        });
        expect(quarantined.status).toBe('quarantined');

        now.ms += COMPLETION_QUARANTINE_WINDOW_MS + 10;
        const recovered = await outbox.recoverMirrorOutbox({
            datasetBound: true,
            datasetNonEmpty: true,
            recordedOwnerId: 'A',
            currentSessionOwnerId: 'A',
            serverVerifiedOwnerId: 'A',
            reconstructedCommitment: {
                bindingSchemaVersion: 1,
                localDatasetId: 'dset-A',
                ownerId: 'A',
                serverDatasetId: null,
                greatestKnownGeneration: 0,
                enrolledAt: null,
            },
        });
        expect(recovered.status).toBe('recovered');

        const applied = await outbox.markSourceDirty(candidate());
        expect(applied.applied).toBe(true);
    });
});
