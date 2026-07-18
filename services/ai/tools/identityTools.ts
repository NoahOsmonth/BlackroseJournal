/**
 * On-device identity write tool (secondary path).
 * Primary path is turn-level extraction — this is for when the model is sure
 * and tools are already enabled.
 */

import {
    applyIdentityPatch,
    buildIdentityContext,
    getIdentityProfile,
    patchIsEmpty,
    profileHasIdentity,
} from '@/services/memory/identityProfile';
import type { IdentityPatch } from '@/services/memory/identityProfile.types';
import type { ToolHandler } from './types';

function asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asPeople(value: unknown): { name: string; relation?: string }[] {
    if (!Array.isArray(value)) return [];
    const out: { name: string; relation?: string }[] = [];
    for (const item of value) {
        if (typeof item === 'string' && item.trim()) {
            out.push({ name: item.trim() });
            continue;
        }
        if (typeof item !== 'object' || item === null) continue;
        const row = item as Record<string, unknown>;
        const name = asString(row.name);
        if (!name) continue;
        out.push({ name, relation: asString(row.relation) });
    }
    return out;
}

function asFacts(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim())
        .slice(0, 6);
}

/** Read current identity for the model (optional; capsule already injects). */
export const getIdentityTool: ToolHandler = async () => {
    const profile = await getIdentityProfile();
    if (!profileHasIdentity(profile)) {
        return 'No identity profile on device yet. When the user states their name or durable facts, call update_identity.';
    }
    return (await buildIdentityContext()) ?? 'Identity profile is empty.';
};

/**
 * Write durable identity fields. Prefer explicit user statements.
 * Contradictions vs an existing preferred name/pronouns/about are held as
 * pendingCandidate (not auto-applied) until the user confirms in Settings.
 */
export const updateIdentityTool: ToolHandler = async (args) => {
    const patch: IdentityPatch = {
        preferredName: asString(args.preferredName) ?? asString(args.name),
        pronouns: asString(args.pronouns),
        about: asString(args.about),
        keyPeople: asPeople(args.keyPeople),
        facts: asFacts(args.facts),
        reason: asString(args.reason) ?? 'model update_identity tool',
        confidence: 0.88,
        source: 'tool',
    };

    if (patchIsEmpty(patch)) {
        return 'Error: provide at least one of preferredName/name, pronouns, about, keyPeople, or facts.';
    }

    const before = await getIdentityProfile();
    const profile = await applyIdentityPatch(patch);
    const name = profile.preferredName?.value;
    const pendingName = profile.preferredName?.pendingCandidate;
    const nameChanged = before.preferredName?.value !== profile.preferredName?.value;
    const pendingSet = Boolean(pendingName)
        && pendingName !== before.preferredName?.pendingCandidate;

    const parts: string[] = [];
    if (pendingSet && !nameChanged && pendingName) {
        parts.push(
            `Identity candidate recorded (not active until confirmed): preferred name "${pendingName}".`,
            name ? `Still using: ${name}.` : undefined,
            'User can confirm or dismiss in Settings.',
        );
    } else {
        parts.push('Identity updated on device.');
        if (name) parts.push(`Preferred name: ${name}.`);
    }
    if (profile.pronouns?.pendingCandidate && profile.pronouns.pendingCandidate !== before.pronouns?.pendingCandidate) {
        parts.push(
            `Pronouns candidate pending confirmation: "${profile.pronouns.pendingCandidate}" (active: ${profile.pronouns.value}).`,
        );
    } else if (profile.pronouns?.value) {
        parts.push(`Pronouns: ${profile.pronouns.value}.`);
    }
    return parts.filter(Boolean).join(' ');
};
