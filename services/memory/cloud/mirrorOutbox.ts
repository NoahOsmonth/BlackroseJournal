/**
 * Durable, content-free mirror work outbox.
 *
 * Sole owner of `@rosebud_cloud_memory_mirror_outbox`. Records only owner-bound
 * work references, retry state, source cursors, tombstones, and parity metadata
 * — never journal/check-in prose. Every read-modify-write runs through one
 * serialized module lock; every parse is guarded and migrated or quarantined,
 * never silently trusted.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
    MarkSourceDirtyInput,
    MirrorAuthState,
    MirrorCapacityReport,
    MirrorCompletionGuard,
    MirrorConsentInput,
    MirrorConsentState,
    MirrorDatasetBindingCommitment,
    MirrorDeletionAckResult,
    MirrorDeliveryState,
    MirrorMarkResult,
    MirrorOutboxEnvelope,
    MirrorOutboxStorageAdapter,
    MirrorQuarantineReason,
    MirrorRecoveryInput,
    MirrorRecoveryResult,
    MirrorSelectedWork,
    MirrorSourceWorkReference,
    MirrorTombstoneReference,
    MirrorVerifiedUnionReceipt,
    TombstoneIntentInput,
} from './mirrorOutbox.types';

export const MIRROR_OUTBOX_STORAGE_KEY = '@rosebud_cloud_memory_mirror_outbox';
export const MIRROR_OUTBOX_SCHEMA_VERSION = 2;

/** Persisted permit/outcome-unknown guard forces a fresh full quarantine window. */
export const COMPLETION_QUARANTINE_WINDOW_MS = 9000;
export const COMPLETION_PERMIT_TTL_MS = 8000;
export const COMPLETION_PERMIT_OFFSET_SAFETY_MS = 1000;
/** Forward-defined layered deadlines for the future HTTP/RPC layer. */
export const CLIENT_REQUEST_DEADLINE_MS = 5000;
export const BACKEND_RPC_DEADLINE_MS = 3500;
export const POSTGRES_STATEMENT_TIMEOUT_MS = 2500;

export const MIRROR_RETRY_BASE_MS = 5000;
export const MIRROR_MAX_PENDING_SOURCES = 2560;
export const MIRROR_MAX_PENDING_TOMBSTONES = 4096;

export const MIRROR_SUSPEND_CODES = [
    '403',
    'OWNER_MISMATCH',
    'CONTRACT_MISMATCH',
    'AUTHORITY_ROLLBACK',
] as const;

const CONTENT_FREE_KEYS = new Set([
    'content', 'contents', 'title', 'summary', 'reasoning', 'analysis',
    'prompt', 'token', 'messages', 'body', 'prose', 'text', 'insight', 'quote',
]);

let adapter: MirrorOutboxStorageAdapter = AsyncStorage;
let clock = (): number => Date.now();
let random = (): number => Math.random();
let capacityOverrides: { maxPendingSources: number | null; maxPendingTombstones: number | null } =
    { maxPendingSources: null, maxPendingTombstones: null };

export function setMirrorOutboxStorageAdapter(next: MirrorOutboxStorageAdapter): void {
    adapter = next;
}

export function resetMirrorOutboxStorageAdapter(): void {
    adapter = AsyncStorage;
}

export function setMirrorOutboxClock(next: () => number): void {
    clock = next;
}

export function resetMirrorOutboxClock(): void {
    clock = () => Date.now();
}

export function setMirrorOutboxRandom(next: () => number): void {
    random = next;
}

export function resetMirrorOutboxRandom(): void {
    random = () => Math.random();
}

export function setMirrorOutboxCapacity(overrides: {
    maxPendingSources?: number;
    maxPendingTombstones?: number;
}): void {
    if (overrides.maxPendingSources !== undefined) capacityOverrides.maxPendingSources = overrides.maxPendingSources;
    if (overrides.maxPendingTombstones !== undefined) capacityOverrides.maxPendingTombstones = overrides.maxPendingTombstones;
}

export function resetMirrorOutboxCapacity(): void {
    capacityOverrides = { maxPendingSources: null, maxPendingTombstones: null };
}

// One serialized queue for ALL read-modify-write cycles on the outbox key.
// AsyncStorage has no transactions; two interleaved load->save pairs would
// silently drop one side's work references.
let writeQueue: Promise<unknown> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
    const run = writeQueue.then(task, task);
    writeQueue = run.catch(() => undefined);
    return run;
}

type MirrorChangeListener = () => void;
const changeListeners = new Set<MirrorChangeListener>();

export function subscribeMirrorOutboxChanges(listener: MirrorChangeListener): () => void {
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

// Quarantine is a process-lifetime marker, re-derived at each process start
// when a completion guard or corrupt-with-nonempty-binding is discovered. It is
// never persisted: a restart naturally re-derives a fresh full window.
//
// `outboxCorruptThisSession` is the in-memory latch for an outbox whose stored
// payload failed to parse. It is set ONLY when the payload itself is conclusively
// untrustable (JSON/coerce failure — durable evidence); a transient read `getItem`
// failure returns the safe-default envelope without latching. The latch blocks
// every outbox mutation until recovery/finalize reconciles the underlying issue
// and rebuilds a valid envelope (it is cleared only then, not by time). There is
// deliberately NO persisted second copy of a corrupt payload: a backup could
// smuggle source prose past the content-free invariant.
let quarantineState: { reason: MirrorQuarantineReason; startedAtMs: number } | null = null;
let outboxCorruptThisSession = false;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const FIELD_INVALID: unique symbol = Symbol('field-invalid');

/** Nullable number that validates (and rejects) a stored value. */
function optionalNumberField(value: unknown): number | null | typeof FIELD_INVALID {
    if (value === null) return null;
    return typeof value === 'number' ? value : FIELD_INVALID;
}

/** Nullable string that validates (and rejects) a stored value. */
function optionalStringField(value: unknown): string | null | typeof FIELD_INVALID {
    if (value === null) return null;
    return typeof value === 'string' ? value : FIELD_INVALID;
}

function nowMs(): number {
    return clock();
}

function nowIso(): string {
    return new Date(nowMs()).toISOString();
}

function isEmptyStringOrNull(value: unknown): boolean {
    return typeof value === 'string' || value === null;
}

function emptyEnvelope(): MirrorOutboxEnvelope {
    return {
        schemaVersion: MIRROR_OUTBOX_SCHEMA_VERSION,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        bindingCommitment: null,
        consentState: {
            ownerId: null,
            localDatasetId: null,
            granted: false,
            grantedAt: null,
            revokedAt: null,
            consentVersion: 0,
        },
        deploymentId: null,
        writerEpoch: null,
        greatestAcceptedAuthorityVersion: null,
        generation: 0,
        activeManifest: null,
        completionGuard: null,
        acknowledgedCursors: {},
        pendingSources: {},
        tombstones: {},
        authState: {
            refreshAttempts: 0,
            suspended: false,
            suspendedCode: null,
            suspendedAt: null,
        },
        lastVerifiedUnion: null,
        completionReceipt: null,
    };
}

function parseCommitment(value: unknown): MirrorDatasetBindingCommitment | null {
    if (value === null) return null;
    if (!isRecord(value)) return null;
    if (
        typeof value.bindingSchemaVersion !== 'number'
        || typeof value.localDatasetId !== 'string'
        || typeof value.ownerId !== 'string'
        || !isEmptyStringOrNull(value.serverDatasetId)
        || typeof value.greatestKnownGeneration !== 'number'
        || !isEmptyStringOrNull(value.enrolledAt)
    ) {
        return null;
    }
    return {
        bindingSchemaVersion: value.bindingSchemaVersion,
        localDatasetId: value.localDatasetId,
        ownerId: value.ownerId,
        serverDatasetId: typeof value.serverDatasetId === 'string' ? value.serverDatasetId : null,
        greatestKnownGeneration: value.greatestKnownGeneration,
        enrolledAt: typeof value.enrolledAt === 'string' ? value.enrolledAt : null,
    };
}

function parseConsent(value: unknown): MirrorConsentState {
    if (!isRecord(value)
        || typeof value.granted !== 'boolean'
        || typeof value.consentVersion !== 'number') {
        return emptyEnvelope().consentState;
    }
    const ownerId = optionalStringField(value.ownerId);
    const localDatasetId = optionalStringField(value.localDatasetId);
    const grantedAt = optionalStringField(value.grantedAt);
    const revokedAt = optionalStringField(value.revokedAt);
    if (ownerId === FIELD_INVALID
        || localDatasetId === FIELD_INVALID
        || grantedAt === FIELD_INVALID
        || revokedAt === FIELD_INVALID) {
        return emptyEnvelope().consentState;
    }
    return {
        ownerId,
        localDatasetId,
        granted: value.granted,
        grantedAt,
        revokedAt,
        consentVersion: value.consentVersion,
    };
}

function parseGuard(value: unknown): MirrorCompletionGuard | null {
    if (value === null) return null;
    if (!isRecord(value)) return null;
    if (
        typeof value.permitId !== 'string'
        || typeof value.manifestId !== 'string'
        || typeof value.generation !== 'number'
        || typeof value.serverExpiresAt !== 'string'
        || typeof value.recordedAt !== 'string'
        || typeof value.outcomeUnknown !== 'boolean'
    ) {
        return null;
    }
    return {
        permitId: value.permitId,
        manifestId: value.manifestId,
        generation: value.generation,
        serverExpiresAt: value.serverExpiresAt,
        recordedAt: value.recordedAt,
        outcomeUnknown: value.outcomeUnknown,
    };
}

function parseAuthState(value: unknown): MirrorAuthState {
    if (isRecord(value)
        && typeof value.refreshAttempts === 'number'
        && typeof value.suspended === 'boolean'
        && isEmptyStringOrNull(value.suspendedCode)
        && isEmptyStringOrNull(value.suspendedAt)) {
        return {
            refreshAttempts: value.refreshAttempts,
            suspended: value.suspended,
            suspendedCode: typeof value.suspendedCode === 'string' ? value.suspendedCode : null,
            suspendedAt: typeof value.suspendedAt === 'string' ? value.suspendedAt : null,
        };
    }
    return emptyEnvelope().authState;
}

function parseSourceReference(value: unknown): MirrorSourceWorkReference | null {
    if (!isRecord(value)) return null;
    if (
        typeof value.sourceId !== 'string'
        || (value.sourceKind !== 'journal' && value.sourceKind !== 'intention_checkin')
        || typeof value.sourceRevision !== 'number'
        || typeof value.messageRevision !== 'number'
        || typeof value.generation !== 'number'
        || typeof value.attempts !== 'number'
    ) {
        return null;
    }
    const previousAcceptedRevision = optionalNumberField(value.previousAcceptedRevision);
    const nextAttemptAt = optionalNumberField(value.nextAttemptAt);
    const lastErrorAt = optionalNumberField(value.lastErrorAt);
    const lastErrorCode = optionalStringField(value.lastErrorCode);
    const blockedReason = optionalStringField(value.blockedReason);
    if (previousAcceptedRevision === FIELD_INVALID
        || nextAttemptAt === FIELD_INVALID
        || lastErrorAt === FIELD_INVALID
        || lastErrorCode === FIELD_INVALID
        || blockedReason === FIELD_INVALID) {
        return null;
    }
    return {
        sourceId: value.sourceId,
        sourceKind: value.sourceKind,
        sourceRevision: value.sourceRevision,
        previousAcceptedRevision,
        messageRevision: value.messageRevision,
        generation: value.generation,
        attempts: value.attempts,
        nextAttemptAt,
        lastErrorCode,
        lastErrorAt,
        blockedReason,
    };
}

function parseDeliveryState(value: unknown): MirrorDeliveryState | null {
    if (!isRecord(value)) return null;
    if (typeof value.attempts !== 'number' || typeof value.acknowledged !== 'boolean') return null;
    const nextAttemptAt = optionalNumberField(value.nextAttemptAt);
    const lastErrorAt = optionalNumberField(value.lastErrorAt);
    const lastErrorCode = optionalStringField(value.lastErrorCode);
    if (nextAttemptAt === FIELD_INVALID
        || lastErrorAt === FIELD_INVALID
        || lastErrorCode === FIELD_INVALID) {
        return null;
    }
    return {
        attempts: value.attempts,
        nextAttemptAt,
        lastErrorCode,
        lastErrorAt,
        acknowledged: value.acknowledged,
    };
}

function parseTombstone(value: unknown): MirrorTombstoneReference | null {
    if (!isRecord(value)) return null;
    if (
        typeof value.sourceId !== 'string'
        || (value.sourceKind !== 'journal' && value.sourceKind !== 'intention_checkin')
        || typeof value.tombstoneRevision !== 'number'
        || typeof value.deletedAt !== 'string'
        || typeof value.generation !== 'number'
        || typeof value.acknowledged !== 'boolean'
        || !isRecord(value.sinkStates)
    ) {
        return null;
    }
    const sinkStates: Record<string, MirrorDeliveryState> = {};
    Object.entries(value.sinkStates).forEach(([sinkId, state]) => {
        const parsed = parseDeliveryState(state);
        if (parsed) sinkStates[sinkId] = parsed;
    });
    return {
        sourceId: value.sourceId,
        sourceKind: value.sourceKind,
        tombstoneRevision: value.tombstoneRevision,
        deletedAt: value.deletedAt,
        generation: value.generation,
        sinkStates,
        acknowledged: value.acknowledged,
    };
}

/**
 * Coerce a stored payload into the current envelope. Returns null when the
 * payload must not be trusted (unknown future schema, structurally malformed):
 * the caller quarantines it and fails closed to a fresh envelope.
 */
function coerceEnvelope(parsed: unknown): MirrorOutboxEnvelope | null {
    if (!isRecord(parsed)) return null;
    const storedVersion = parsed.schemaVersion;
    if (typeof storedVersion !== 'number' || storedVersion < 1 || storedVersion > MIRROR_OUTBOX_SCHEMA_VERSION) {
        return null;
    }
    const base = emptyEnvelope();
    base.schemaVersion = MIRROR_OUTBOX_SCHEMA_VERSION;
    if (typeof parsed.createdAt === 'string') base.createdAt = parsed.createdAt;
    if (typeof parsed.updatedAt === 'string') base.updatedAt = parsed.updatedAt;

    base.bindingCommitment = parseCommitment(parsed.bindingCommitment);
    base.consentState = parseConsent(parsed.consentState);
    base.deploymentId = typeof parsed.deploymentId === 'string' ? parsed.deploymentId : null;
    base.writerEpoch = typeof parsed.writerEpoch === 'number' ? parsed.writerEpoch : null;
    base.greatestAcceptedAuthorityVersion = typeof parsed.greatestAcceptedAuthorityVersion === 'number'
        ? parsed.greatestAcceptedAuthorityVersion
        : null;
    if (typeof parsed.generation === 'number' && Number.isSafeInteger(parsed.generation) && parsed.generation >= 0) {
        base.generation = parsed.generation;
    }
    base.completionGuard = parseGuard(parsed.completionGuard);
    base.authState = parseAuthState(parsed.authState);

    if (isRecord(parsed.acknowledgedCursors)) {
        Object.entries(parsed.acknowledgedCursors).forEach(([sourceId, cursor]) => {
            if (isRecord(cursor)
                && typeof cursor.sourceRevision === 'number'
                && typeof cursor.acceptedAt === 'string') {
                base.acknowledgedCursors[sourceId] = {
                    sourceRevision: cursor.sourceRevision,
                    acceptedAt: cursor.acceptedAt,
                };
            }
        });
    }
    if (isRecord(parsed.pendingSources)) {
        Object.entries(parsed.pendingSources).forEach(([sourceId, reference]) => {
            const parsedRef = parseSourceReference(reference);
            if (parsedRef && parsedRef.sourceId === sourceId) base.pendingSources[sourceId] = parsedRef;
        });
    }
    if (parsed.tombstones === undefined) {
        // Legacy v1 payloads predate the tombstone ledger: migrate them with an
        // empty ledger rather than treating a missing key as total corruption.
        base.tombstones = {};
    } else if (!isRecord(parsed.tombstones)) {
        return null;
    } else {
        Object.entries(parsed.tombstones).forEach(([sourceId, tombstone]) => {
            const parsedTombstone = parseTombstone(tombstone);
            if (parsedTombstone && parsedTombstone.sourceId === sourceId) base.tombstones[sourceId] = parsedTombstone;
        });
    }

    if (isRecord(parsed.lastVerifiedUnion)
        && typeof parsed.lastVerifiedUnion.receipt === 'string'
        && typeof parsed.lastVerifiedUnion.sourceSetVersion === 'number'
        && typeof parsed.lastVerifiedUnion.conversationCount === 'number'
        && typeof parsed.lastVerifiedUnion.messageCount === 'number'
        && typeof parsed.lastVerifiedUnion.hash === 'string'
        && typeof parsed.lastVerifiedUnion.acceptedAt === 'string') {
        base.lastVerifiedUnion = {
            receipt: parsed.lastVerifiedUnion.receipt,
            sourceSetVersion: parsed.lastVerifiedUnion.sourceSetVersion,
            conversationCount: parsed.lastVerifiedUnion.conversationCount,
            messageCount: parsed.lastVerifiedUnion.messageCount,
            hash: parsed.lastVerifiedUnion.hash,
            acceptedAt: parsed.lastVerifiedUnion.acceptedAt,
        };
    }
    if (isRecord(parsed.completionReceipt)
        && typeof parsed.completionReceipt.manifestId === 'string'
        && typeof parsed.completionReceipt.receipt === 'string'
        && typeof parsed.completionReceipt.completedAt === 'string') {
        base.completionReceipt = {
            manifestId: parsed.completionReceipt.manifestId,
            receipt: parsed.completionReceipt.receipt,
            completedAt: parsed.completionReceipt.completedAt,
        };
    }
    return base;
}

async function loadEnvelope(): Promise<MirrorOutboxEnvelope> {
    let raw: string | null;
    try {
        raw = await adapter.getItem(MIRROR_OUTBOX_STORAGE_KEY);
    } catch {
        // A transient read failure returns the safe default WITHOUT latching the
        // corrupt flag: there is no durable evidence the payload is untrustable.
        return emptyEnvelope();
    }
    if (!raw) return emptyEnvelope();

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        latchCorruptQuarantine();
        return emptyEnvelope();
    }
    const envelope = coerceEnvelope(parsed);
    if (!envelope) {
        latchCorruptQuarantine();
        return emptyEnvelope();
    }
    if (envelope.completionGuard && !quarantineState) {
        // A persisted permit/outcome-unknown guard starts a fresh full window.
        quarantineState = { reason: 'startup_guard', startedAtMs: nowMs() };
    }
    return envelope;
}

/**
 * Set the in-memory corrupt latch. Never persists a second copy of the payload:
 * the untrusted bytes stay at the owned key (so a restart re-derives the latch)
 * but are never written anywhere else, and the outbox fails closed to the
 * safe-default envelope until recovery reconciles the corruption.
 */
function latchCorruptQuarantine(): void {
    outboxCorruptThisSession = true;
}

function enforceContentFree(value: unknown, path = 'root'): void {
    if (Array.isArray(value)) {
        value.forEach((entry, index) => enforceContentFree(entry, `${path}[${index}]`));
        return;
    }
    if (!isRecord(value)) return;
    Object.keys(value).forEach((key) => {
        if (CONTENT_FREE_KEYS.has(key)) {
            throw new Error(`mirror outbox content-free violation at ${path}.${key}`);
        }
        enforceContentFree(value[key], `${path}.${key}`);
    });
}

async function saveEnvelope(envelope: MirrorOutboxEnvelope): Promise<void> {
    enforceContentFree(envelope);
    envelope.updatedAt = nowIso();
    await adapter.setItem(MIRROR_OUTBOX_STORAGE_KEY, JSON.stringify(envelope));
}

function quarantineActive(): boolean {
    // An un-reconciled corrupt outbox is always quarantined until recovery
    // rebuilds a valid envelope; time alone never releases it.
    if (outboxCorruptThisSession) return true;
    if (!quarantineState) return false;
    return nowMs() - quarantineState.startedAtMs < COMPLETION_QUARANTINE_WINDOW_MS;
}

/**
 * Returns the block reason for outbox mutation, or null when mutation is
 * allowed. While the corrupt latch is set every mutation is blocked until
 * recovery/finalize reconciles the underlying issue: allowing a write would
 * silently rebuild the outbox from untrustable bytes and lose the authority
 * signals (bindingCommitment, cursors) that quarantine is meant to preserve.
 */
function mutationBlockReason(): 'quarantine' | null {
    if (outboxCorruptThisSession) return 'quarantine';
    if (!quarantineState) return null;
    const elapsed = nowMs() - quarantineState.startedAtMs;
    if (elapsed < COMPLETION_QUARANTINE_WINDOW_MS) return 'quarantine';
    // startup_guard auto-releases by time (below): every server permit on that
    // guard is expired, so local mutation cannot double-deliver; the stale guard
    // is reconciled by finalizeStaleCompletionGuard, not silently dropped here.
    // An unreconciled corrupt-outbox quarantine, by contrast, NEVER auto-releases
    // by time: it stays blocked until the recorded owner is server-verified and
    // the outbox is rebuilt. It must never silently rebuild to a stranger.
    if (quarantineState.reason === 'outbox_corrupt_nonempty') return 'quarantine';
    return null;
}

/**
 * Blocks only when the outbox is an un-reconciled corrupt payload. Guard
 * lifecycle writes (begin / mark-outcome-unknown) must still run INSIDE the
 * quarantine window — they are how the coordinator records and resolves the
 * guard — so they are blocked by the corrupt latch alone, never by an active
 * startup_guard window.
 */
function corruptLatchBlockReason(): 'quarantine' | null {
    return outboxCorruptThisSession ? 'quarantine' : null;
}

function maxPendingSources(): number {
    return capacityOverrides.maxPendingSources ?? MIRROR_MAX_PENDING_SOURCES;
}

function maxPendingTombstones(): number {
    return capacityOverrides.maxPendingTombstones ?? MIRROR_MAX_PENDING_TOMBSTONES;
}

function jitteredDelay(attempt: number): number {
    const raw = MIRROR_RETRY_BASE_MS * 2 ** (attempt - 1);
    const factor = 0.8 + 0.4 * random();
    return Math.round(raw * factor);
}

export async function markSourceDirty(input: MarkSourceDirtyInput): Promise<MirrorMarkResult> {
    return withLock(async () => {
        const envelope = await loadEnvelope();
        const block = mutationBlockReason();
        if (block) return { applied: false, blocked: true, reason: block };
        if (envelope.tombstones[input.sourceId]) {
            // A committed tombstone is never coalesced away by a racing edit.
            return { applied: false, blocked: true, reason: 'tombstoned' };
        }
        const existing = envelope.pendingSources[input.sourceId];
        const cursor = envelope.acknowledgedCursors[input.sourceId];
        envelope.generation += 1;
        const previousAccepted = Math.max(
            existing?.previousAcceptedRevision ?? 0,
            input.previousAcceptedRevision ?? 0,
            cursor?.sourceRevision ?? 0,
        ) || null;
        const overCapacity = Object.keys(envelope.pendingSources).length >= maxPendingSources();
        const next: MirrorSourceWorkReference = {
            sourceId: input.sourceId,
            sourceKind: input.sourceKind,
            sourceRevision: input.sourceRevision,
            previousAcceptedRevision: previousAccepted,
            messageRevision: Math.max(existing?.messageRevision ?? 0, input.messageRevision),
            generation: envelope.generation,
            attempts: existing?.attempts ?? 0,
            nextAttemptAt: existing?.nextAttemptAt ?? null,
            lastErrorCode: existing?.lastErrorCode ?? null,
            lastErrorAt: existing?.lastErrorAt ?? null,
            blockedReason: overCapacity ? 'capacity' : null,
        };
        envelope.pendingSources[input.sourceId] = next;
        if (cursor) delete envelope.acknowledgedCursors[input.sourceId];
        await saveEnvelope(envelope);
        notifyChanged();
        return { applied: true, generation: envelope.generation };
    });
}

export async function reportInvalidSource(
    input: MarkSourceDirtyInput,
    code: string,
): Promise<MirrorMarkResult> {
    return withLock(async () => {
        const envelope = await loadEnvelope();
        const block = mutationBlockReason();
        if (block) return { applied: false, blocked: true, reason: block };
        if (envelope.tombstones[input.sourceId]) {
            return { applied: false, blocked: true, reason: 'tombstoned' };
        }
        const existing = envelope.pendingSources[input.sourceId];
        envelope.generation += 1;
        envelope.pendingSources[input.sourceId] = {
            sourceId: input.sourceId,
            sourceKind: input.sourceKind,
            sourceRevision: input.sourceRevision,
            previousAcceptedRevision: existing?.previousAcceptedRevision
                ?? input.previousAcceptedRevision
                ?? envelope.acknowledgedCursors[input.sourceId]?.sourceRevision
                ?? null,
            messageRevision: Math.max(existing?.messageRevision ?? 0, input.messageRevision),
            generation: envelope.generation,
            attempts: existing?.attempts ?? 0,
            nextAttemptAt: existing?.nextAttemptAt ?? null,
            lastErrorCode: code,
            lastErrorAt: nowMs(),
            blockedReason: 'invalid_source',
        };
        delete envelope.acknowledgedCursors[input.sourceId];
        await saveEnvelope(envelope);
        notifyChanged();
        return { applied: true, generation: envelope.generation };
    });
}

export async function resetMirrorSuspension(): Promise<{ ok: boolean; blocked?: boolean; reason?: 'quarantine' }> {
    return withLock(async () => {
        const envelope = await loadEnvelope();
        const block = mutationBlockReason();
        if (block) return { ok: false, blocked: true, reason: block };
        envelope.authState.suspended = false;
        envelope.authState.suspendedCode = null;
        envelope.authState.suspendedAt = null;
        envelope.authState.refreshAttempts = 0;
        await saveEnvelope(envelope);
        notifyChanged();
        return { ok: true };
    });
}

export async function acknowledgeSource(
    sourceId: string,
    input: { acceptedRevision: number; acceptedAt?: string },
): Promise<{ ok: boolean; generation: number; blocked?: boolean; reason?: 'quarantine' }> {
    return withLock(async () => {
        const envelope = await loadEnvelope();
        const block = mutationBlockReason();
        if (block) return { ok: false, generation: envelope.generation, blocked: true, reason: block };
        delete envelope.pendingSources[sourceId];
        envelope.acknowledgedCursors[sourceId] = {
            sourceRevision: input.acceptedRevision,
            acceptedAt: input.acceptedAt ?? nowIso(),
        };
        // A successful server acknowledgement proves the auth path works.
        envelope.authState.refreshAttempts = 0;
        await saveEnvelope(envelope);
        notifyChanged();
        return { ok: true, generation: envelope.generation };
    });
}

export async function recordMirrorAttempt(
    target: { kind: 'source'; sourceId: string }
        | { kind: 'tombstone'; sourceId: string; sinkId: string },
    errorCode: string,
    attemptedAtMs: number,
): Promise<{ ok: boolean; suspended: boolean; suspensionCode: string | null; blocked?: boolean; reason?: 'quarantine' }> {
    return withLock(async () => {
        const envelope = await loadEnvelope();
        const block = mutationBlockReason();
        if (block) return { ok: false, suspended: false, suspensionCode: null, blocked: true, reason: block };
        const suspend = (code: string): void => {
            envelope.authState.suspended = true;
            envelope.authState.suspendedCode = code;
            envelope.authState.suspendedAt = nowIso();
        };
        const isSuspendCode = (MIRROR_SUSPEND_CODES as readonly string[]).includes(errorCode);

        if (isSuspendCode) {
            suspend(errorCode);
            markSubjectError(envelope, target, errorCode, attemptedAtMs);
            await saveEnvelope(envelope);
            notifyChanged();
            return { ok: true, suspended: true, suspensionCode: errorCode };
        }
        if (errorCode === '401') {
            if (envelope.authState.refreshAttempts < 1) {
                // At most one refresh attempt before suspending.
                envelope.authState.refreshAttempts += 1;
                markSubjectError(envelope, target, errorCode, attemptedAtMs);
                await saveEnvelope(envelope);
                notifyChanged();
                return { ok: true, suspended: false, suspensionCode: null };
            }
            suspend('401');
            markSubjectError(envelope, target, errorCode, attemptedAtMs);
            await saveEnvelope(envelope);
            notifyChanged();
            return { ok: true, suspended: true, suspensionCode: '401' };
        }
        // Transient/retryable: persisted exponential backoff with bounded jitter.
        bumpAttempts(envelope, target, errorCode, attemptedAtMs);
        await saveEnvelope(envelope);
        notifyChanged();
        return { ok: true, suspended: false, suspensionCode: null };
    });
}

function bumpAttempts(
    envelope: MirrorOutboxEnvelope,
    target: { kind: 'source'; sourceId: string } | { kind: 'tombstone'; sourceId: string; sinkId: string },
    errorCode: string,
    attemptedAtMs: number,
): void {
    if (target.kind === 'source') {
        const reference = envelope.pendingSources[target.sourceId];
        if (!reference) return;
        reference.attempts += 1;
        reference.nextAttemptAt = attemptedAtMs + jitteredDelay(reference.attempts);
        reference.lastErrorCode = errorCode;
        reference.lastErrorAt = attemptedAtMs;
        return;
    }
    const tombstone = envelope.tombstones[target.sourceId];
    if (!tombstone) return;
    const sink = tombstone.sinkStates[target.sinkId];
    if (!sink) return;
    sink.attempts += 1;
    sink.nextAttemptAt = attemptedAtMs + jitteredDelay(sink.attempts);
    sink.lastErrorCode = errorCode;
    sink.lastErrorAt = attemptedAtMs;
}

function markSubjectError(
    envelope: MirrorOutboxEnvelope,
    target: { kind: 'source'; sourceId: string } | { kind: 'tombstone'; sourceId: string; sinkId: string },
    errorCode: string,
    attemptedAtMs: number,
): void {
    if (target.kind === 'source') {
        const reference = envelope.pendingSources[target.sourceId];
        if (!reference) return;
        reference.lastErrorCode = errorCode;
        reference.lastErrorAt = attemptedAtMs;
        return;
    }
    const sink = envelope.tombstones[target.sourceId]?.sinkStates[target.sinkId];
    if (!sink) return;
    sink.lastErrorCode = errorCode;
    sink.lastErrorAt = attemptedAtMs;
}

export async function importTombstoneIntent(input: TombstoneIntentInput): Promise<MirrorMarkResult> {
    return withLock(async () => {
        const envelope = await loadEnvelope();
        const block = mutationBlockReason();
        if (block) return { applied: false, blocked: true, reason: block };
        const existing = envelope.tombstones[input.sourceId];
        if (existing && existing.tombstoneRevision >= input.tombstoneRevision) {
            return { applied: true, generation: envelope.generation };
        }
        envelope.generation += 1;
        const sinkStates: Record<string, MirrorDeliveryState> = {};
        input.sinkIds.forEach((sinkId) => {
            sinkStates[sinkId] = {
                attempts: 0,
                nextAttemptAt: null,
                lastErrorCode: null,
                lastErrorAt: null,
                acknowledged: false,
            };
        });
        envelope.tombstones[input.sourceId] = {
            sourceId: input.sourceId,
            sourceKind: input.sourceKind,
            tombstoneRevision: input.tombstoneRevision,
            deletedAt: input.deletedAt,
            generation: envelope.generation,
            sinkStates,
            acknowledged: false,
        };
        // A tombstoned source must not remain as ordinary pending source work.
        delete envelope.pendingSources[input.sourceId];
        await saveEnvelope(envelope);
        notifyChanged();
        return { applied: true, generation: envelope.generation };
    });
}

export async function recordTombstoneAttempt(
    sourceId: string,
    sinkId: string,
    errorCode: string,
    attemptedAtMs: number,
): Promise<{ ok: boolean; suspended: boolean; suspensionCode: string | null }> {
    return recordMirrorAttempt({ kind: 'tombstone', sourceId, sinkId }, errorCode, attemptedAtMs);
}

export async function acknowledgeDeletion(sourceId: string, sinkId: string): Promise<MirrorDeletionAckResult> {
    return withLock(async () => {
        const envelope = await loadEnvelope();
        const block = mutationBlockReason();
        if (block) return { ok: false, acknowledged: false, reason: block };
        const tombstone = envelope.tombstones[sourceId];
        if (!tombstone) return { ok: false, acknowledged: false, reason: 'unknown_tombstone' };
        delete tombstone.sinkStates[sinkId];
        if (Object.keys(tombstone.sinkStates).length === 0) {
            tombstone.acknowledged = true;
        }
        // The permanent content-free deletion commitment itself is never purged.
        await saveEnvelope(envelope);
        notifyChanged();
        return { ok: true, acknowledged: tombstone.acknowledged };
    });
}

export async function selectMirrorWork(options: { limit?: number } = {}): Promise<MirrorSelectedWork[]> {
    const limit = options.limit ?? 100;
    const envelope = await loadEnvelope();
    const selected: MirrorSelectedWork[] = [];

    Object.entries(envelope.tombstones).forEach(([sourceId, tombstone]) => {
        if (selected.length >= limit) return;
        Object.entries(tombstone.sinkStates).forEach(([sinkId, sink]) => {
            if (sink.acknowledged || selected.length >= limit) return;
            selected.push({
                kind: 'tombstone',
                sourceId,
                sourceKind: tombstone.sourceKind,
                tombstoneRevision: tombstone.tombstoneRevision,
                sinkId,
                generation: tombstone.generation,
                attempts: sink.attempts,
            });
        });
    });

    Object.entries(envelope.pendingSources).forEach(([sourceId, reference]) => {
        if (selected.length >= limit) return;
        if (reference.blockedReason !== null) return;
        selected.push({
            kind: 'source',
            sourceId,
            sourceKind: reference.sourceKind,
            sourceRevision: reference.sourceRevision,
            previousAcceptedRevision: reference.previousAcceptedRevision,
            generation: reference.generation,
            attempts: reference.attempts,
        });
    });

    return selected;
}

export async function beginCompletionGuard(input: {
    permitId: string;
    manifestId: string;
    generation: number;
    serverExpiresAt: string;
}): Promise<{ ok: boolean; guard: MirrorCompletionGuard | null; blocked?: boolean; reason?: 'quarantine' }> {
    return withLock(async () => {
        const envelope = await loadEnvelope();
        const block = corruptLatchBlockReason();
        if (block) return { ok: false, guard: null, blocked: true, reason: block };
        const guard: MirrorCompletionGuard = {
            permitId: input.permitId,
            manifestId: input.manifestId,
            generation: input.generation,
            serverExpiresAt: input.serverExpiresAt,
            recordedAt: nowIso(),
            outcomeUnknown: false,
        };
        envelope.completionGuard = guard;
        await saveEnvelope(envelope);
        notifyChanged();
        return { ok: true, guard };
    });
}

export async function markCompletionOutcomeUnknown(): Promise<
    { ok: boolean; guard: MirrorCompletionGuard | null; blocked?: boolean; reason?: 'quarantine' }
> {
    return withLock(async () => {
        const envelope = await loadEnvelope();
        const block = corruptLatchBlockReason();
        if (block) return { ok: false, guard: null, blocked: true, reason: block };
        if (!envelope.completionGuard) return { ok: true, guard: null };
        envelope.completionGuard.outcomeUnknown = true;
        await saveEnvelope(envelope);
        notifyChanged();
        return { ok: true, guard: envelope.completionGuard };
    });
}

export async function resolveCompletionGuard(input: {
    status: 'completed' | 'cancelled' | 'expired';
    manifestId?: string;
    receipt?: string;
}): Promise<{ ok: boolean }> {
    return withLock(async () => {
        const envelope = await loadEnvelope();
        const guard = envelope.completionGuard;
        if (!guard) return { ok: true };
        if (input.status === 'completed' && input.manifestId && input.receipt) {
            envelope.completionReceipt = {
                manifestId: input.manifestId,
                receipt: input.receipt,
                completedAt: nowIso(),
            };
        }
        envelope.completionGuard = null;
        quarantineState = null;
        await saveEnvelope(envelope);
        notifyChanged();
        return { ok: true };
    });
}

export async function finalizeStaleCompletionGuard(): Promise<
    { ok: true; generation: number } | { ok: false; blocked: true; reason: 'quarantine' }
> {
    return withLock(async () => {
        const envelope = await loadEnvelope();
        if (!envelope.completionGuard && !quarantineState) return { ok: true, generation: envelope.generation };
        if (quarantineActive()) return { ok: false, blocked: true, reason: 'quarantine' };
        // Only the startup-guard quarantine is reconciled here. A corrupt-outbox
        // quarantine is recovered exclusively by recoverMirrorOutbox (owner-
        // verified rebuild); finalize must not collapse the guard state for it.
        if (quarantineState && quarantineState.reason !== 'startup_guard') {
            return { ok: false, blocked: true, reason: 'quarantine' };
        }
        envelope.completionGuard = null;
        envelope.generation += 1;
        quarantineState = null;
        // Rebuilding a valid envelope reconciles any corrupt latch too.
        outboxCorruptThisSession = false;
        await saveEnvelope(envelope);
        notifyChanged();
        return { ok: true, generation: envelope.generation };
    });
}

export async function isMirrorQuarantineActive(): Promise<boolean> {
    await loadEnvelope();
    return quarantineActive();
}

export async function getMirrorQuarantine(): Promise<{
    active: boolean;
    reason: MirrorQuarantineReason | null;
}> {
    await loadEnvelope();
    return { active: quarantineActive(), reason: quarantineState?.reason ?? null };
}

export async function recoverMirrorOutbox(input: MirrorRecoveryInput): Promise<MirrorRecoveryResult> {
    return withLock(async () => {
        const envelope = await loadEnvelope();
        const missingOrCorrupt = outboxCorruptThisSession
            || (await adapter.getItem(MIRROR_OUTBOX_STORAGE_KEY)) === null;

        if (envelope.completionGuard && !quarantineState) {
            quarantineState = { reason: 'startup_guard', startedAtMs: nowMs() };
        }
        const corruptTrigger = (input.datasetBound || input.datasetNonEmpty) && missingOrCorrupt;
        if (corruptTrigger && !quarantineState) {
            quarantineState = { reason: 'outbox_corrupt_nonempty', startedAtMs: nowMs() };
        }
        if (!quarantineState) {
            // Nothing needed recovery. A corrupt outbox over an EMPTY/unbound
            // dataset never demands quarantine (no authority to protect), so
            // recovery reconciles it by releasing the latch: the next valid write
            // simply rebuilds the envelope from the safe default.
            outboxCorruptThisSession = false;
            return { status: 'ready' };
        }

        const remainingMs = COMPLETION_QUARANTINE_WINDOW_MS - (nowMs() - quarantineState.startedAtMs);
        if (remainingMs > 0) {
            return {
                status: 'quarantined',
                reason: quarantineState.reason,
                quarantineWindowMs: COMPLETION_QUARANTINE_WINDOW_MS,
                remainingMs,
            };
        }

        if (quarantineState.reason === 'startup_guard') {
            envelope.completionGuard = null;
            envelope.generation += 1;
            quarantineState = null;
            // A rebuilt valid envelope clears any corrupt latch; no future read
            // re-arms a fresh window for the recovered state.
            outboxCorruptThisSession = false;
            await saveEnvelope(envelope);
            notifyChanged();
            return { status: 'recovered', ownerId: envelope.bindingCommitment?.ownerId ?? null, generation: envelope.generation };
        }

        // A rebuild requires SERVER-verified ownership. Session identity alone
        // (currentSessionOwnerId) must never drive a rebuild: the whole point of
        // the corrupt-outbox quarantine is that a fresh session claiming a
        // nonempty dataset cannot walk off with it until the server confirms the
        // original owner. When the binding never recorded an owner there is
        // nothing to protect, so a server-verified (or absent) owner may proceed.
        const recordedOwner = input.recordedOwnerId ?? envelope.bindingCommitment?.ownerId ?? null;
        const verifiedOwner = input.serverVerifiedOwnerId;
        if (recordedOwner !== null && verifiedOwner !== recordedOwner) {
            return { status: 'requires_original_owner', ownerId: recordedOwner };
        }
        if (input.reconstructedCommitment) {
            envelope.bindingCommitment = { ...input.reconstructedCommitment };
        }
        envelope.generation += 1;
        quarantineState = null;
        outboxCorruptThisSession = false;
        await saveEnvelope(envelope);
        notifyChanged();
        return {
            status: 'recovered',
            ownerId: envelope.bindingCommitment?.ownerId ?? null,
            generation: envelope.generation,
        };
    });
}

export async function reportMirrorCapacity(): Promise<MirrorCapacityReport> {
    const envelope = await loadEnvelope();
    const pendingSourceCount = Object.keys(envelope.pendingSources).length;
    const pendingTombstoneCount = Object.keys(envelope.tombstones).length;
    return {
        blocked: pendingSourceCount > maxPendingSources() || pendingTombstoneCount > maxPendingTombstones(),
        pendingSourceCount,
        pendingTombstoneCount,
        maxPendingSources: maxPendingSources(),
        maxPendingTombstones: maxPendingTombstones(),
        nothingEvicted: true,
    };
}

export async function setConsentState(input: MirrorConsentInput): Promise<MirrorMarkResult> {
    return withLock(async () => {
        const envelope = await loadEnvelope();
        const block = mutationBlockReason();
        if (block) return { applied: false, blocked: true, reason: block };
        envelope.consentState = {
            ownerId: input.ownerId,
            localDatasetId: input.localDatasetId,
            granted: input.granted,
            grantedAt: input.grantedAt,
            revokedAt: input.revokedAt,
            consentVersion: input.consentVersion,
        };
        await saveEnvelope(envelope);
        notifyChanged();
        return { applied: true, generation: envelope.generation };
    });
}

export async function getConsentState(): Promise<MirrorConsentState> {
    const envelope = await loadEnvelope();
    return envelope.consentState;
}

export async function setBindingReplica(
    commitment: MirrorDatasetBindingCommitment | null,
): Promise<MirrorMarkResult> {
    return withLock(async () => {
        const envelope = await loadEnvelope();
        const block = mutationBlockReason();
        if (block) return { applied: false, blocked: true, reason: block };
        envelope.bindingCommitment = commitment;
        await saveEnvelope(envelope);
        notifyChanged();
        return { applied: true, generation: envelope.generation };
    });
}

export async function getBindingReplica(): Promise<MirrorDatasetBindingCommitment | null> {
    const envelope = await loadEnvelope();
    return envelope.bindingCommitment;
}

export async function setDeploymentState(input: {
    deploymentId: string;
    writerEpoch: number;
    greatestAcceptedAuthorityVersion: number | null;
}): Promise<MirrorMarkResult> {
    return withLock(async () => {
        const envelope = await loadEnvelope();
        const block = mutationBlockReason();
        if (block) return { applied: false, blocked: true, reason: block };
        envelope.deploymentId = input.deploymentId;
        envelope.writerEpoch = input.writerEpoch;
        envelope.greatestAcceptedAuthorityVersion = input.greatestAcceptedAuthorityVersion;
        await saveEnvelope(envelope);
        notifyChanged();
        return { applied: true, generation: envelope.generation };
    });
}

export async function setVerifiedUnion(receipt: MirrorVerifiedUnionReceipt): Promise<MirrorMarkResult> {
    return withLock(async () => {
        const envelope = await loadEnvelope();
        const block = mutationBlockReason();
        if (block) return { applied: false, blocked: true, reason: block };
        envelope.lastVerifiedUnion = receipt;
        await saveEnvelope(envelope);
        notifyChanged();
        return { applied: true, generation: envelope.generation };
    });
}

export async function setActiveManifest(manifest: MirrorOutboxEnvelope['activeManifest']): Promise<MirrorMarkResult> {
    return withLock(async () => {
        const envelope = await loadEnvelope();
        const block = mutationBlockReason();
        if (block) return { applied: false, blocked: true, reason: block };
        envelope.activeManifest = manifest;
        await saveEnvelope(envelope);
        notifyChanged();
        return { applied: true, generation: envelope.generation };
    });
}

export async function getEnvelopeSnapshot(): Promise<MirrorOutboxEnvelope> {
    const envelope = await loadEnvelope();
    return {
        ...envelope,
        acknowledgedCursors: { ...envelope.acknowledgedCursors },
        pendingSources: { ...envelope.pendingSources },
        tombstones: { ...envelope.tombstones },
    };
}

export async function clearMirrorOutbox(): Promise<void> {
    await withLock(async () => {
        try {
            await adapter.removeItem(MIRROR_OUTBOX_STORAGE_KEY);
        } finally {
            outboxCorruptThisSession = false;
            quarantineState = null;
        }
    });
}
