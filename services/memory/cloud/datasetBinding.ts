/**
 * Dataset-to-owner binding (replicated, never inferred from an outbox default).
 *
 * Sole owner of `@rosebud_memory_dataset_binding`. Writes the primary binding
 * intent first, then copies the content-free replicas in the fixed
 * journal -> check-in -> outbox order (the journal/check-in source envelopes
 * arrive in Task 8; only the outbox replica exists today), then marks the
 * primary complete. Startup repairs an interrupted replication only when every
 * surviving commitment agrees; a corrupt/missing outbox can never make a
 * nonempty dataset unbound and eligible for a new owner.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBindingReplica, setBindingReplica } from './mirrorOutbox';
import type {
    BindingReplicaId,
    DatasetBindingEnvelope,
    DatasetBindResult,
    DatasetBindingStorageAdapter,
    DatasetReconcileResult,
} from './datasetBinding.types';
import { BINDING_REPLICA_ORDER } from './datasetBinding.types';
import type { MirrorDatasetBindingCommitment } from './mirrorOutbox.types';

export const DATASET_BINDING_STORAGE_KEY = '@rosebud_memory_dataset_binding';
export const DATASET_BINDING_SCHEMA_VERSION = 1;

let adapter: DatasetBindingStorageAdapter = AsyncStorage;

export function setDatasetBindingStorageAdapter(next: DatasetBindingStorageAdapter): void {
    adapter = next;
}

export function resetDatasetBindingStorageAdapter(): void {
    adapter = AsyncStorage;
}

// One serialized queue for every read-modify-write on the binding key (see the
// outbox module for the same rationale).
let writeQueue: Promise<unknown> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
    const run = writeQueue.then(task, task);
    writeQueue = run.catch(() => undefined);
    return run;
}

type BindingChangeListener = () => void;
const changeListeners = new Set<BindingChangeListener>();

export function subscribeBindingChanges(listener: BindingChangeListener): () => void {
    changeListeners.add(listener);
    return () => {
        changeListeners.delete(listener);
    };
}

function notifyChanged(): void {
    changeListeners.forEach((listener) => {
        try {
            listener();
        } catch {
            // A broken listener must never break a write.
        }
    });
}

function nowIso(): string {
    return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRecovery(value: unknown): DatasetBindingEnvelope['recovery'] {
    const fallback: DatasetBindingEnvelope['recovery'] = { required: false, reason: null, since: null };
    if (!isRecord(value) || typeof value.required !== 'boolean') return fallback;
    if (!value.required) return fallback;
    const reason = value.reason === 'conflicting_commitments' || value.reason === 'all_commitments_lost'
        ? value.reason
        : null;
    return {
        required: true,
        reason,
        since: typeof value.since === 'string' ? value.since : null,
    };
}

/**
 * Parse the primary binding. Corrupt or malformed primary data is not trusted:
 * returns null so callers treat the binding as missing and fail closed.
 */
function parseBinding(value: unknown): DatasetBindingEnvelope | null {
    if (!isRecord(value)) return null;
    if (typeof value.bindingSchemaVersion !== 'number'
        || value.bindingSchemaVersion > DATASET_BINDING_SCHEMA_VERSION) {
        return null;
    }
    if (value.replicaWritePhase !== 'idle'
        && value.replicaWritePhase !== 'replicating'
        && value.replicaWritePhase !== 'complete') {
        return null;
    }
    if (typeof value.localDatasetId !== 'string'
        || typeof value.ownerId !== 'string'
        || (value.serverDatasetId !== null && typeof value.serverDatasetId !== 'string')
        || typeof value.greatestKnownGeneration !== 'number'
        || (value.enrolledAt !== null && typeof value.enrolledAt !== 'string')
        || typeof value.createdAt !== 'string'
        || typeof value.updatedAt !== 'string') {
        return null;
    }
    return {
        bindingSchemaVersion: value.bindingSchemaVersion,
        replicaWritePhase: value.replicaWritePhase,
        localDatasetId: value.localDatasetId,
        ownerId: value.ownerId,
        serverDatasetId: typeof value.serverDatasetId === 'string' ? value.serverDatasetId : null,
        greatestKnownGeneration: value.greatestKnownGeneration,
        enrolledAt: typeof value.enrolledAt === 'string' ? value.enrolledAt : null,
        recovery: parseRecovery(value.recovery),
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
    };
}

async function loadBinding(): Promise<DatasetBindingEnvelope | null> {
    let raw: string | null;
    try {
        raw = await adapter.getItem(DATASET_BINDING_STORAGE_KEY);
    } catch {
        return null;
    }
    if (!raw) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        // A corrupt primary is never trusted; quarantine by removal. Subsequent
        // reconciliation with nonempty sources fails closed.
        await adapter.removeItem(DATASET_BINDING_STORAGE_KEY);
        return null;
    }
    const binding = parseBinding(parsed);
    if (!binding) {
        await adapter.removeItem(DATASET_BINDING_STORAGE_KEY);
        return null;
    }
    return binding;
}

async function saveBinding(binding: DatasetBindingEnvelope): Promise<void> {
    binding.updatedAt = nowIso();
    await adapter.setItem(DATASET_BINDING_STORAGE_KEY, JSON.stringify(binding));
}

function commitmentFromBinding(binding: DatasetBindingEnvelope): MirrorDatasetBindingCommitment {
    return {
        bindingSchemaVersion: binding.bindingSchemaVersion,
        localDatasetId: binding.localDatasetId,
        ownerId: binding.ownerId,
        serverDatasetId: binding.serverDatasetId,
        greatestKnownGeneration: binding.greatestKnownGeneration,
        enrolledAt: binding.enrolledAt,
    };
}

function replicasMatch(
    binding: DatasetBindingEnvelope,
    replica: MirrorDatasetBindingCommitment | null,
): boolean {
    return replica !== null
        && replica.ownerId === binding.ownerId
        && replica.localDatasetId === binding.localDatasetId;
}

async function writeOutboxReplica(binding: DatasetBindingEnvelope): Promise<boolean> {
    const written = await setBindingReplica(commitmentFromBinding(binding));
    return written.applied;
}

async function clearOutboxReplica(): Promise<void> {
    await setBindingReplica(null);
}

export async function getDatasetBinding(): Promise<DatasetBindingEnvelope | null> {
    return loadBinding();
}

export async function bindDataset(input: {
    ownerId: string;
    localDatasetId: string;
    datasetNonEmpty: boolean;
    allowEmptyRebind?: boolean;
}): Promise<DatasetBindResult> {
    return withLock(async () => {
        const existing = await loadBinding();
        if (existing) {
            if (existing.recovery.required) return { status: 'binding_recovery_required' };
            if (existing.ownerId !== input.ownerId) {
                if (input.datasetNonEmpty || !input.allowEmptyRebind) {
                    return { status: 'owner_mismatch', existingOwnerId: existing.ownerId };
                }
                // Explicit empty-dataset rebind path: the coordinator owns the
                // decision; the binding module never infers it.
            } else if (existing.replicaWritePhase === 'replicating') {
                const replica = await getBindingReplica();
                if (replicasMatch(existing, replica)) {
                    existing.replicaWritePhase = 'complete';
                    await saveBinding(existing);
                    notifyChanged();
                    return { status: 'bound', binding: existing };
                }
                return { status: 'owner_mismatch', existingOwnerId: existing.ownerId };
            } else {
                return { status: 'bound', binding: existing };
            }
        }

        // Write the primary intent, then replicas in fixed order, then complete.
        const primary: DatasetBindingEnvelope = {
            bindingSchemaVersion: DATASET_BINDING_SCHEMA_VERSION,
            replicaWritePhase: 'replicating',
            localDatasetId: input.localDatasetId,
            ownerId: input.ownerId,
            serverDatasetId: null,
            greatestKnownGeneration: 0,
            enrolledAt: null,
            recovery: { required: false, reason: null, since: null },
            createdAt: nowIso(),
            updatedAt: nowIso(),
        };
        await saveBinding(primary);

        // Task 8 extension point: journal then check-in source-envelope replicas
        // are written here, in BINDING_REPLICA_ORDER, before the outbox replica.
        const sourceReplicasWritten = await writeSourceEnvelopeReplicas(primary);
        if (!sourceReplicasWritten) {
            await restorePreviousBinding(existing, primary);
            return { status: 'replica_write_blocked', reason: 'source_replica_blocked' };
        }
        const outboxWritten = await writeOutboxReplica(primary);
        if (!outboxWritten) {
            await restorePreviousBinding(existing, primary);
            return { status: 'replica_write_blocked', reason: 'outbox_replica_blocked' };
        }

        primary.replicaWritePhase = 'complete';
        await saveBinding(primary);
        notifyChanged();
        return { status: 'bound', binding: primary };
    });
}

/**
 * Source-envelope replicas land in Task 8. Until then every surviving
 * commitment (journal/check-in) trivially agrees, so this returns true.
 * Fixed replica order is preserved for the later work.
 */
async function writeSourceEnvelopeReplicas(binding: DatasetBindingEnvelope): Promise<boolean> {
    void binding;
    const replicas: { written: true }[] = await Promise.all(
        (BINDING_REPLICA_ORDER as readonly BindingReplicaId[])
            .filter((id) => id === 'journal' || id === 'checkin')
            .map(async () => ({ written: true as const })),
    );
    return replicas.every((replica) => replica.written);
}

async function restorePreviousBinding(
    previous: DatasetBindingEnvelope | null,
    pending: DatasetBindingEnvelope,
): Promise<void> {
    if (previous) {
        await saveBinding(previous);
    } else {
        await adapter.removeItem(DATASET_BINDING_STORAGE_KEY);
    }
    await clearOutboxReplica();
    void pending;
}

export async function markDatasetEnrolled(input: { serverDatasetId: string }): Promise<
    { status: 'enrolled' } | { status: 'not_bound' } | { status: 'binding_recovery_required' }
> {
    return withLock(async () => {
        const binding = await loadBinding();
        if (!binding) return { status: 'not_bound' };
        if (binding.recovery.required) return { status: 'binding_recovery_required' };
        binding.serverDatasetId = input.serverDatasetId;
        binding.enrolledAt = nowIso();
        await saveBinding(binding);
        notifyChanged();
        return { status: 'enrolled' };
    });
}

export async function reconcileDatasetBinding(input: {
    datasetNonEmpty: boolean;
    currentSessionOwnerId: string | null;
    serverVerifiedOwnerId: string | null;
}): Promise<DatasetReconcileResult> {
    return withLock(async () => {
        const binding = await loadBinding();
        const replica = await getBindingReplica();
        const hasReplica = replica !== null;
        const hasLocalRecords = input.datasetNonEmpty || hasReplica;

        if (!binding) {
            // All commitments lost while sources/tombstones exist: fail closed.
            if (hasLocalRecords) {
                return { status: 'binding_recovery_required' };
            }
            return { status: 'unbound' };
        }
        if (binding.recovery.required) return { status: 'binding_recovery_required' };

        if (hasReplica && !replicasMatch(binding, replica)) {
            binding.recovery = {
                required: true,
                reason: 'conflicting_commitments',
                since: nowIso(),
            };
            await saveBinding(binding);
            notifyChanged();
            return { status: 'binding_recovery_required' };
        }

        const needsReconstruction = binding.replicaWritePhase !== 'complete' || !hasReplica;
        if (needsReconstruction) {
            if (input.serverVerifiedOwnerId === binding.ownerId) {
                const written = await setBindingReplica(commitmentFromBinding(binding));
                if (!written.applied) {
                    // The mirror outbox is quarantined (corrupt/missing over
                    // nonempty data); the coordinator must run outbox recovery
                    // before this binding repair may write its replica.
                    return { status: 'outbox_recovery_required', ownerId: binding.ownerId };
                }
                if (binding.replicaWritePhase !== 'complete') {
                    binding.replicaWritePhase = 'complete';
                }
                await saveBinding(binding);
                notifyChanged();
                return { status: 'repaired', ownerId: binding.ownerId };
            }
            return { status: 'requires_original_owner', ownerId: binding.ownerId };
        }

        return { status: 'bound', ownerId: binding.ownerId };
    });
}

export async function clearDatasetBinding(): Promise<void> {
    await withLock(async () => {
        await adapter.removeItem(DATASET_BINDING_STORAGE_KEY);
        await clearOutboxReplica();
    });
}
