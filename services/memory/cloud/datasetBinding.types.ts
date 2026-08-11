/**
 * Dataset-to-owner binding types.
 *
 * The primary binding key carries the schema/binding version, a random local
 * dataset ID, an explicit owner ID, an optional server dataset ID, the greatest
 * known generation, and an in-progress replica-write phase. It contains no
 * prose and no tokens. Content-free replicas of this commitment live in the
 * journal/check-in source envelopes (Task 8) and the mirror outbox (Task 3).
 */

/** Fixed source-envelope replica write order; journal/check-in arrive in Task 8. */
export const BINDING_REPLICA_ORDER = ['journal', 'checkin', 'outbox'] as const;
export type BindingReplicaId = typeof BINDING_REPLICA_ORDER[number];

export type ReplicaWritePhase = 'idle' | 'replicating' | 'complete';

export type BindingRecoveryReason = 'conflicting_commitments' | 'all_commitments_lost';

export interface DatasetBindingRecoveryState {
    required: boolean;
    reason: BindingRecoveryReason | null;
    since: string | null;
}

export interface DatasetBindingEnvelope {
    bindingSchemaVersion: number;
    replicaWritePhase: ReplicaWritePhase;
    localDatasetId: string;
    ownerId: string;
    serverDatasetId: string | null;
    greatestKnownGeneration: number;
    enrolledAt: string | null;
    recovery: DatasetBindingRecoveryState;
    createdAt: string;
    updatedAt: string;
}

export type DatasetBindResult =
    | { status: 'bound'; binding: DatasetBindingEnvelope }
    | { status: 'owner_mismatch'; existingOwnerId: string }
    | { status: 'binding_recovery_required' }
    | { status: 'replica_write_blocked'; reason: string };

export type DatasetReconcileResult =
    | { status: 'unbound' }
    | { status: 'bound'; ownerId: string }
    | { status: 'repaired'; ownerId: string }
    | { status: 'requires_original_owner'; ownerId: string }
    | { status: 'binding_recovery_required' };

export interface DatasetBindingStorageAdapter {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}
