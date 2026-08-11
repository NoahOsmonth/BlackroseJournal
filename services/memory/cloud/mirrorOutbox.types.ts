/**
 * Content-free durable mirror work outbox types.
 *
 * The outbox records ONLY owner-bound work references, retry state, source
 * cursors, tombstones, and parity metadata. It must be structurally impossible
 * to store journal/check-in prose here: no field below maps to source content.
 */

export type MirrorSourceKind = 'journal' | 'intention_checkin';

/** Replica of the authoritative dataset-owner binding commitment (content-free). */
export interface MirrorDatasetBindingCommitment {
    bindingSchemaVersion: number;
    localDatasetId: string;
    ownerId: string;
    serverDatasetId: string | null;
    greatestKnownGeneration: number;
    enrolledAt: string | null;
}

/** Versioned per-owner/local-dataset consent state with grant/revoke timestamps. */
export interface MirrorConsentState {
    ownerId: string | null;
    localDatasetId: string | null;
    granted: boolean;
    grantedAt: string | null;
    revokedAt: string | null;
    consentVersion: number;
}

/** Per-source compact work reference. No prose, no tokens. */
export interface MirrorSourceWorkReference {
    sourceId: string;
    sourceKind: MirrorSourceKind;
    /** Current positive local source revision. */
    sourceRevision: number;
    /** Last accepted server cursor for this source, if any. */
    previousAcceptedRevision: number | null;
    /** Compact per-message revision counter. */
    messageRevision: number;
    generation: number;
    attempts: number;
    nextAttemptAt: number | null;
    lastErrorCode: string | null;
    lastErrorAt: number | null;
    /** e.g. 'capacity' | 'invalid_source' when this reference must not upload. */
    blockedReason: string | null;
}

/** Per-sink delivery/retry state for one tombstone reference (removable on ack). */
export interface MirrorDeliveryState {
    attempts: number;
    nextAttemptAt: number | null;
    lastErrorCode: string | null;
    lastErrorAt: number | null;
    acknowledged: boolean;
}

/**
 * Tombstone delivery reference copied from the authoritative source-owner
 * tombstone ledger. The permanent content-free commitment survives all sink
 * acknowledgements; only per-sink retry/attempt state is ever removed.
 */
export interface MirrorTombstoneReference {
    sourceId: string;
    sourceKind: MirrorSourceKind;
    tombstoneRevision: number;
    deletedAt: string;
    generation: number;
    sinkStates: Record<string, MirrorDeliveryState>;
    acknowledged: boolean;
}

/** Persisted completion guard. No token, no prose. */
export interface MirrorCompletionGuard {
    permitId: string;
    manifestId: string;
    generation: number;
    serverExpiresAt: string;
    recordedAt: string;
    outcomeUnknown: boolean;
}

export interface MirrorActiveManifest {
    manifestId: string;
    generation: number;
    createdAt: string;
    phase: 'created' | 'uploading' | 'prepared';
}

export type MirrorQuarantineReason = 'startup_guard' | 'outbox_corrupt_nonempty';

export interface MirrorAuthState {
    refreshAttempts: number;
    suspended: boolean;
    suspendedCode: string | null;
    suspendedAt: string | null;
}

export interface MirrorAcknowledgedCursor {
    sourceRevision: number;
    acceptedAt: string;
}

export interface MirrorVerifiedUnionReceipt {
    receipt: string;
    sourceSetVersion: number;
    conversationCount: number;
    messageCount: number;
    hash: string;
    acceptedAt: string;
}

export interface MirrorCompletedManifestReceipt {
    manifestId: string;
    receipt: string;
    completedAt: string;
}

export interface MirrorOutboxEnvelope {
    schemaVersion: number;
    createdAt: string;
    updatedAt: string;
    bindingCommitment: MirrorDatasetBindingCommitment | null;
    consentState: MirrorConsentState;
    deploymentId: string | null;
    writerEpoch: number | null;
    greatestAcceptedAuthorityVersion: number | null;
    generation: number;
    activeManifest: MirrorActiveManifest | null;
    completionGuard: MirrorCompletionGuard | null;
    acknowledgedCursors: Record<string, MirrorAcknowledgedCursor>;
    pendingSources: Record<string, MirrorSourceWorkReference>;
    tombstones: Record<string, MirrorTombstoneReference>;
    authState: MirrorAuthState;
    lastVerifiedUnion: MirrorVerifiedUnionReceipt | null;
    completionReceipt: MirrorCompletedManifestReceipt | null;
}

export interface MarkSourceDirtyInput {
    sourceId: string;
    sourceKind: MirrorSourceKind;
    sourceRevision: number;
    previousAcceptedRevision: number | null;
    messageRevision: number;
}

export interface TombstoneIntentInput {
    sourceId: string;
    sourceKind: MirrorSourceKind;
    tombstoneRevision: number;
    deletedAt: string;
    sinkIds: readonly string[];
}

export type MirrorMarkBlockReason =
    | 'quarantine'
    | 'tombstoned'
    | 'owner_mismatch'
    | 'binding_recovery_required'
    | 'auth_required';

export type MirrorMarkResult =
    | { applied: true; generation: number }
    | { applied: false; blocked: true; reason: MirrorMarkBlockReason };

export type MirrorSelectedWork =
    | {
          kind: 'tombstone';
          sourceId: string;
          sourceKind: MirrorSourceKind;
          tombstoneRevision: number;
          sinkId: string;
          generation: number;
          attempts: number;
      }
    | {
          kind: 'source';
          sourceId: string;
          sourceKind: MirrorSourceKind;
          sourceRevision: number;
          previousAcceptedRevision: number | null;
          generation: number;
          attempts: number;
      };

export interface MirrorCapacityReport {
    blocked: boolean;
    pendingSourceCount: number;
    pendingTombstoneCount: number;
    maxPendingSources: number;
    maxPendingTombstones: number;
    /** The outbox never evicts to make room; this is always true. */
    nothingEvicted: true;
}

export interface MirrorRecoveryInput {
    datasetBound: boolean;
    datasetNonEmpty: boolean;
    /** Owner recorded in the surviving primary binding/replica, if any. */
    recordedOwnerId: string | null;
    /**
     * Owner identity of the current session. Retained for coordinator context
     * only — it NEVER authorizes a corrupt-outbox rebuild. A rebuild of a
     * quarantined outbox requires `serverVerifiedOwnerId` to match the recorded
     * owner (a fresh session must not walk off with a nonempty dataset).
     */
    currentSessionOwnerId: string | null;
    /** Server-confirmed owner identity; the only identity that authorizes rebuild. */
    serverVerifiedOwnerId: string | null;
    reconstructedCommitment: MirrorDatasetBindingCommitment | null;
}

export type MirrorRecoveryResult =
    | { status: 'ready' }
    | { status: 'quarantined'; reason: MirrorQuarantineReason; quarantineWindowMs: number; remainingMs: number }
    | { status: 'requires_original_owner'; ownerId: string }
    | { status: 'recovered'; ownerId: string | null; generation: number };

export interface MirrorDeletionAckResult {
    ok: boolean;
    acknowledged: boolean;
    reason?: string;
}

export interface MirrorConsentInput {
    ownerId: string;
    localDatasetId: string;
    granted: boolean;
    grantedAt: string;
    revokedAt: string | null;
    consentVersion: number;
}

export interface MirrorOutboxStorageAdapter {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}
