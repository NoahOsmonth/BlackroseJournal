/**
 * Pure view-model helpers for Settings Identity section.
 * No I/O — safe for UI and tests.
 */

import type {
    IdentityField,
    IdentityProfile,
    IdentityScalarField,
} from './identityProfile.types';
import { IDENTITY_SCALAR_FIELDS } from './identityProfile.types';

export interface IdentityScalarRow {
    readonly key: IdentityScalarField;
    readonly label: string;
    readonly field: IdentityField;
    readonly hasPending: boolean;
}

export interface IdentityCollectionRow {
    readonly kind: 'person' | 'fact';
    readonly id: string;
    readonly label: string;
    readonly value: string;
}

/** "preferredName" → "Preferred name" */
export function humanizeIdentityFieldKey(key: string): string {
    const spaced = key
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .trim();
    if (!spaced) return key;
    return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function isIdentityFieldShape(value: unknown): value is IdentityField {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return typeof v.value === 'string' && v.value.trim().length > 0;
}

/**
 * Confirmed scalar rows + any pending candidates, derived by iterating the
 * store's scalar field set (not a hard-coded single name control).
 */
export function listScalarIdentityRows(profile: IdentityProfile): readonly IdentityScalarRow[] {
    const rows: IdentityScalarRow[] = [];
    for (const key of IDENTITY_SCALAR_FIELDS) {
        const field = profile[key];
        if (!isIdentityFieldShape(field)) continue;
        rows.push({
            key,
            label: humanizeIdentityFieldKey(key),
            field,
            hasPending: Boolean(field.pendingCandidate?.trim()),
        });
    }
    return rows;
}

/** Only fields with a pendingCandidate (for Confirm/Dismiss cards). */
export function listPendingIdentityCandidates(
    profile: IdentityProfile,
): readonly IdentityScalarRow[] {
    return listScalarIdentityRows(profile).filter((row) => row.hasPending);
}

/** Active people + facts for read-only confirmed lists. */
export function listConfirmedCollectionRows(
    profile: IdentityProfile,
): readonly IdentityCollectionRow[] {
    const rows: IdentityCollectionRow[] = [];
    for (const person of profile.keyPeople) {
        if (person.invalidatedAt) continue;
        rows.push({
            kind: 'person',
            id: `person:${person.name}`,
            label: 'Key person',
            value: person.relation ? `${person.name} (${person.relation})` : person.name,
        });
    }
    for (const fact of profile.facts) {
        if (fact.invalidatedAt) continue;
        rows.push({
            kind: 'fact',
            id: fact.id,
            label: 'Fact',
            value: fact.content,
        });
    }
    return rows;
}

export function countPendingIdentityCandidates(profile: IdentityProfile): number {
    return listPendingIdentityCandidates(profile).length;
}

export function identitySettingsSummary(profile: IdentityProfile | null | undefined): string {
    if (!profile) return 'Not set';
    const pending = countPendingIdentityCandidates(profile);
    const name = profile.preferredName?.value?.trim();
    if (pending > 0) {
        return pending === 1 ? '1 pending change' : `${pending} pending changes`;
    }
    if (name) return name;
    const scalars = listScalarIdentityRows(profile).length;
    const collections = listConfirmedCollectionRows(profile).length;
    if (scalars + collections === 0) return 'Not set';
    return 'On device';
}
