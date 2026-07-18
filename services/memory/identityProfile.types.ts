import type { StorageAdapter } from '@/services/journal/journalStorage.types';

/** How a field value was written. */
export type IdentityFieldSource = 'extraction' | 'tool' | 'manual' | 'system';

/** A single durable identity value with provenance + supersession history. */
export interface IdentityField {
    value: string;
    confidence: number;
    source: IdentityFieldSource;
    updatedAt: number;
    /**
     * Contradicting candidate vs an **already-confirmed** value — never auto-promoted.
     * First-time capture always writes `value` directly (auto-confirm).
     * Confirm via confirmIdentityPendingField / Settings; dismiss via dismissIdentityPendingField.
     */
    pendingCandidate?: string;
    /** Prior confirmed values kept for audit after an explicit supersede (confirm/manual). */
    previousValues?: readonly IdentityFieldRevision[];
}

export interface IdentityFieldRevision {
    value: string;
    confidence: number;
    source: IdentityFieldSource;
    updatedAt: number;
    invalidatedAt: number;
    reason?: string;
}

/** Named person the user talks about (partner, friend, pet, etc.). */
export interface IdentityPerson {
    name: string;
    relation?: string;
    confidence: number;
    source: IdentityFieldSource;
    updatedAt: number;
    /** Soft-delete: kept in storage but hidden from prompt. */
    invalidatedAt?: number;
}

/** Freeform durable fact (preference, job, location, …). */
export interface IdentityFact {
    id: string;
    content: string;
    confidence: number;
    source: IdentityFieldSource;
    updatedAt: number;
    invalidatedAt?: number;
}

/**
 * Always-on core identity — separate from ranked memory atoms.
 * Injected every session; never competes with the 6-atom / 1200-char capsule.
 */
export interface IdentityProfile {
    schemaVersion: number;
    preferredName?: IdentityField;
    pronouns?: IdentityField;
    /** Short "who they are" blurb (job, life stage, etc.). */
    about?: IdentityField;
    keyPeople: IdentityPerson[];
    facts: IdentityFact[];
    updatedAt: number;
}

/** Scalar identity fields that support pendingCandidate contradictions. */
export type IdentityScalarField = 'preferredName' | 'pronouns' | 'about';

/**
 * Ordered list of scalar fields for Settings UI iteration.
 * Do not special-case a single "name" field in UI — walk this list (and grow it here).
 */
export const IDENTITY_SCALAR_FIELDS: readonly IdentityScalarField[] = [
    'preferredName',
    'pronouns',
    'about',
] as const;

/** Delta produced by extraction or the update_identity tool. */
export interface IdentityPatch {
    preferredName?: string;
    pronouns?: string;
    about?: string;
    keyPeople?: readonly { name: string; relation?: string }[];
    facts?: readonly string[];
    /** Audit reason when forcing a supersede (confirm / manual Settings edit). */
    reason?: string;
    confidence?: number;
    source?: IdentityFieldSource;
    /**
     * When true, a differing value supersedes immediately (previousValues audit).
     * Default false: extraction/tool contradictions go to pendingCandidate only.
     * Manual Settings edits and confirmIdentityPendingField set this.
     */
    forceApply?: boolean;
}

export type IdentityStorageAdapter = StorageAdapter;
