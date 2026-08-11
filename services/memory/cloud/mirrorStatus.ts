/**
 * Mirror status view + consent/egress authority.
 *
 * This module has no storage key of its own. It derives public mirror status
 * from the outbox envelope (consent state + quarantine) and the dataset binding
 * (owner, enrollment), persists consent through the outbox envelope, and fires
 * `subscribeMirrorStatus` only on meaningful state changes.
 *
 * Egress classes model the future network layer's gate:
 *  - sourceCopy (enroll/source-copy) requires explicit consent + bound dataset;
 *  - privacySafety (cancel/tombstone/state/parity) stays open for an already
 *    enrolled dataset even after consent revocation, without claiming hosted
 *    deletion or clearing local sources.
 */

import {
    getConsentState,
    getEnvelopeSnapshot,
    getMirrorQuarantine,
    setConsentState,
    subscribeMirrorOutboxChanges,
} from './mirrorOutbox';
import {
    getDatasetBinding,
    subscribeBindingChanges,
} from './datasetBinding';
import type { MirrorConsentInput } from './mirrorOutbox.types';

export type MirrorEgressClass = 'sourceCopy' | 'privacySafety';

export interface MirrorStatusSession {
    signedIn?: boolean;
    allowlisted?: boolean;
    datasetNonEmpty?: boolean;
}

export interface MirrorStatusSnapshot {
    ok: boolean;
    quarantined: boolean;
    quarantineReason: string | null;
    suspended: boolean;
    suspensionCode: string | null;
    consentGranted: boolean;
    datasetBound: boolean;
    datasetEnrolled: boolean;
    bindingRecoveryRequired: boolean;
    ownerId: string | null;
    serverDatasetId: string | null;
    pendingSourceCount: number;
    pendingTombstoneCount: number;
    egress: Record<MirrorEgressClass, boolean>;
}

type StatusListener = () => void;
const statusListeners = new Set<StatusListener>();

let wired = false;
let unwireOutbox: (() => void) | null = null;
let unwireBinding: (() => void) | null = null;

function notifyStatusChanged(): void {
    statusListeners.forEach((listener) => {
        try {
            listener();
        } catch {
            // A broken listener must never break a state change.
        }
    });
}

function ensureWired(): void {
    if (wired) return;
    unwireOutbox = subscribeMirrorOutboxChanges(() => notifyStatusChanged());
    unwireBinding = subscribeBindingChanges(() => notifyStatusChanged());
    wired = true;
}

export function resetMirrorStatusWiring(): void {
    unwireOutbox?.();
    unwireBinding?.();
    unwireOutbox = null;
    unwireBinding = null;
    wired = false;
    statusListeners.clear();
}

export function subscribeMirrorStatus(listener: StatusListener): () => void {
    ensureWired();
    statusListeners.add(listener);
    return () => {
        statusListeners.delete(listener);
    };
}

export async function setMirrorConsent(
    granted: boolean,
    bind: { ownerId: string; localDatasetId: string },
): Promise<{ applied: boolean; reason?: string }> {
    const binding = await getDatasetBinding();
    if (binding && binding.ownerId !== bind.ownerId) {
        return { applied: false, reason: 'owner_mismatch' };
    }
    const consent = await getConsentState();
    const nowIso = new Date().toISOString();
    const input: MirrorConsentInput = {
        ownerId: bind.ownerId,
        localDatasetId: bind.localDatasetId,
        granted,
        grantedAt: granted ? (consent.grantedAt ?? nowIso) : consent.grantedAt,
        revokedAt: granted ? null : nowIso,
        consentVersion: consent.consentVersion + 1,
    };
    const written = await setConsentState(input);
    return { applied: written.applied };
}

export async function egressAllowedFor(
    egressClass: MirrorEgressClass,
    session: MirrorStatusSession = {},
): Promise<boolean> {
    const status = await getMirrorStatus(session);
    return status.egress[egressClass];
}

export async function getMirrorStatus(session: MirrorStatusSession = {}): Promise<MirrorStatusSnapshot> {
    ensureWired();
    const [envelope, binding, quarantine] = await Promise.all([
        getEnvelopeSnapshot(),
        getDatasetBinding(),
        getMirrorQuarantine(),
    ]);

    const signedIn = session.signedIn ?? false;
    const allowlisted = session.allowlisted ?? false;
    const consentOwnerMatches = envelope.consentState.ownerId === binding?.ownerId;
    const consentGranted = envelope.consentState.granted && consentOwnerMatches;
    const datasetBound = binding !== null;
    const datasetEnrolled = binding !== null
        && binding.serverDatasetId !== null
        && binding.enrolledAt !== null;
    const suspended = envelope.authState.suspended;

    const sourceCopy = consentGranted
        && datasetBound
        && signedIn
        && allowlisted
        && !suspended
        && !quarantine.active;
    const privacySafety = datasetEnrolled
        && signedIn
        && !suspended
        && !quarantine.active;

    return {
        ok: !suspended && !quarantine.active && !(binding?.recovery.required ?? false),
        quarantined: quarantine.active,
        quarantineReason: quarantine.reason,
        suspended,
        suspensionCode: envelope.authState.suspendedCode,
        consentGranted,
        datasetBound,
        datasetEnrolled,
        bindingRecoveryRequired: binding?.recovery.required ?? false,
        ownerId: binding?.ownerId ?? null,
        serverDatasetId: binding?.serverDatasetId ?? null,
        pendingSourceCount: Object.keys(envelope.pendingSources).length,
        pendingTombstoneCount: Object.keys(envelope.tombstones).length,
        egress: { sourceCopy, privacySafety },
    };
}
