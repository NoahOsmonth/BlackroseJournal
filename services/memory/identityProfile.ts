/**
 * Always-on identity profile (core memory).
 *
 * Separate from ranked `@rosebud_local_memory` atoms so a preferred name never
 * loses to the top-6 / 1200-char capsule or the 3-slot profile-atom cap.
 * Zep/Graphiti-style: supersede by invalidating prior values, never silent wipe.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
    IdentityFact,
    IdentityField,
    IdentityFieldRevision,
    IdentityFieldSource,
    IdentityPatch,
    IdentityPerson,
    IdentityProfile,
    IdentityScalarField,
    IdentityStorageAdapter,
} from './identityProfile.types';

export type { IdentityScalarField } from './identityProfile.types';

export const IDENTITY_PROFILE_STORAGE_KEY = '@rosebud_identity_profile';
export const IDENTITY_PROFILE_CORRUPT_BACKUP_KEY = '@rosebud_identity_profile_corrupt';
export const IDENTITY_PROFILE_SCHEMA_VERSION = 1;

const MAX_KEY_PEOPLE = 12;
const MAX_FACTS = 24;
const MAX_PREVIOUS_VALUES = 5;
const MAX_FIELD_CHARS = 120;
const MAX_FACT_CHARS = 200;
const MAX_CONTEXT_CHARS = 900;

let identityStorageAdapter: IdentityStorageAdapter = AsyncStorage;

export function setIdentityStorageAdapter(adapter: IdentityStorageAdapter): void {
    identityStorageAdapter = adapter;
}

export function resetIdentityStorageAdapter(): void {
    identityStorageAdapter = AsyncStorage;
}

let writeQueue: Promise<unknown> = Promise.resolve();

function withIdentityLock<T>(task: () => Promise<T>): Promise<T> {
    const run = writeQueue.then(task, task);
    writeQueue = run.catch(() => undefined);
    return run;
}

type IdentityChangeListener = () => void;
const identityChangeListeners = new Set<IdentityChangeListener>();

export function subscribeIdentityChanges(listener: IdentityChangeListener): () => void {
    identityChangeListeners.add(listener);
    return () => {
        identityChangeListeners.delete(listener);
    };
}

function notifyIdentityChanged(): void {
    identityChangeListeners.forEach((listener) => {
        try {
            listener();
        } catch {
            // A broken listener must never break a write.
        }
    });
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

function trimText(value: string, maxLength: number): string {
    const clean = value.trim().replace(/\s+/g, ' ');
    return clean.length > maxLength ? `${clean.slice(0, maxLength).trim()}...` : clean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function emptyProfile(now = Date.now()): IdentityProfile {
    return {
        schemaVersion: IDENTITY_PROFILE_SCHEMA_VERSION,
        keyPeople: [],
        facts: [],
        updatedAt: now,
    };
}

function isValidFieldSource(value: unknown): value is IdentityFieldSource {
    return value === 'extraction'
        || value === 'tool'
        || value === 'manual'
        || value === 'system';
}

function sanitizeField(value: unknown): IdentityField | undefined {
    if (!isRecord(value)) return undefined;
    if (typeof value.value !== 'string' || !value.value.trim()) return undefined;
    if (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence)) return undefined;
    if (!isValidFieldSource(value.source)) return undefined;
    if (typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt)) return undefined;

    const previousValues: IdentityFieldRevision[] = [];
    if (Array.isArray(value.previousValues)) {
        for (const rev of value.previousValues) {
            if (!isRecord(rev)) continue;
            if (typeof rev.value !== 'string' || !rev.value.trim()) continue;
            if (typeof rev.confidence !== 'number' || !Number.isFinite(rev.confidence)) continue;
            if (!isValidFieldSource(rev.source)) continue;
            if (typeof rev.updatedAt !== 'number' || !Number.isFinite(rev.updatedAt)) continue;
            if (typeof rev.invalidatedAt !== 'number' || !Number.isFinite(rev.invalidatedAt)) continue;
            previousValues.push({
                value: trimText(rev.value, MAX_FIELD_CHARS),
                confidence: clamp01(rev.confidence),
                source: rev.source,
                updatedAt: rev.updatedAt,
                invalidatedAt: rev.invalidatedAt,
                reason: typeof rev.reason === 'string' ? rev.reason : undefined,
            });
            if (previousValues.length >= MAX_PREVIOUS_VALUES) break;
        }
    }

    const pendingCandidate = typeof value.pendingCandidate === 'string' && value.pendingCandidate.trim()
        ? trimText(value.pendingCandidate, MAX_FIELD_CHARS)
        : undefined;

    return {
        value: trimText(value.value, MAX_FIELD_CHARS),
        confidence: clamp01(value.confidence),
        source: value.source,
        updatedAt: value.updatedAt,
        pendingCandidate,
        previousValues: previousValues.length > 0 ? previousValues : undefined,
    };
}

function sanitizePerson(value: unknown): IdentityPerson | null {
    if (!isRecord(value)) return null;
    if (typeof value.name !== 'string' || !value.name.trim()) return null;
    if (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence)) return null;
    if (!isValidFieldSource(value.source)) return null;
    if (typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt)) return null;
    return {
        name: trimText(value.name, 60),
        relation: typeof value.relation === 'string' && value.relation.trim()
            ? trimText(value.relation, 60)
            : undefined,
        confidence: clamp01(value.confidence),
        source: value.source,
        updatedAt: value.updatedAt,
        invalidatedAt: typeof value.invalidatedAt === 'number' && Number.isFinite(value.invalidatedAt)
            ? value.invalidatedAt
            : undefined,
    };
}

function sanitizeFact(value: unknown): IdentityFact | null {
    if (!isRecord(value)) return null;
    if (typeof value.id !== 'string' || !value.id) return null;
    if (typeof value.content !== 'string' || !value.content.trim()) return null;
    if (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence)) return null;
    if (!isValidFieldSource(value.source)) return null;
    if (typeof value.updatedAt !== 'number' || !Number.isFinite(value.updatedAt)) return null;
    return {
        id: value.id,
        content: trimText(value.content, MAX_FACT_CHARS),
        confidence: clamp01(value.confidence),
        source: value.source,
        updatedAt: value.updatedAt,
        invalidatedAt: typeof value.invalidatedAt === 'number' && Number.isFinite(value.invalidatedAt)
            ? value.invalidatedAt
            : undefined,
    };
}

function sanitizeProfile(value: unknown): IdentityProfile {
    if (!isRecord(value)) return emptyProfile();
    const keyPeople = Array.isArray(value.keyPeople)
        ? value.keyPeople.map(sanitizePerson).filter((p): p is IdentityPerson => p !== null).slice(0, MAX_KEY_PEOPLE)
        : [];
    const facts = Array.isArray(value.facts)
        ? value.facts.map(sanitizeFact).filter((f): f is IdentityFact => f !== null).slice(0, MAX_FACTS)
        : [];
    return {
        schemaVersion: IDENTITY_PROFILE_SCHEMA_VERSION,
        preferredName: sanitizeField(value.preferredName),
        pronouns: sanitizeField(value.pronouns),
        about: sanitizeField(value.about),
        keyPeople,
        facts,
        updatedAt: typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt)
            ? value.updatedAt
            : Date.now(),
    };
}

async function loadProfile(): Promise<IdentityProfile> {
    try {
        const json = await identityStorageAdapter.getItem(IDENTITY_PROFILE_STORAGE_KEY);
        if (!json) return emptyProfile();
        let parsed: unknown;
        try {
            parsed = JSON.parse(json);
        } catch {
            try {
                await identityStorageAdapter.setItem(IDENTITY_PROFILE_CORRUPT_BACKUP_KEY, json);
                await identityStorageAdapter.removeItem(IDENTITY_PROFILE_STORAGE_KEY);
            } catch {
                // Best effort.
            }
            return emptyProfile();
        }
        return sanitizeProfile(parsed);
    } catch {
        return emptyProfile();
    }
}

async function saveProfile(profile: IdentityProfile): Promise<void> {
    const envelope: IdentityProfile = {
        ...profile,
        schemaVersion: IDENTITY_PROFILE_SCHEMA_VERSION,
    };
    await identityStorageAdapter.setItem(IDENTITY_PROFILE_STORAGE_KEY, JSON.stringify(envelope));
}

export async function getIdentityProfile(): Promise<IdentityProfile> {
    return loadProfile();
}

export async function clearIdentityProfile(): Promise<void> {
    await withIdentityLock(async () => {
        await identityStorageAdapter.removeItem(IDENTITY_PROFILE_STORAGE_KEY);
    });
    notifyIdentityChanged();
}

function normalizeComparable(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function factId(content: string): string {
    return `fact:${normalizeComparable(content).replace(/[^a-z0-9]+/g, '-').slice(0, 48)}`;
}

function personKey(name: string): string {
    return normalizeComparable(name);
}

/**
 * Merge a single scalar field (design §6.3 / Memory v2 product rule):
 * - unset → set: **auto-confirm** immediately (no Settings / PR7 UI required)
 * - set → same: reinforce confidence; clear pendingCandidate
 * - set → different: pendingCandidate only (genuine contradiction of a confirmed value)
 * - forceApply (manual Settings / confirm): supersede + previousValues audit
 *
 * Pending is never used for first capture. Without a confirmed value there is
 * nothing to contradict — first write becomes `value` so ## Identity is non-empty
 * right away. PR7 is only for resolving later contradictions.
 */
function mergeField(
    existing: IdentityField | undefined,
    nextValue: string,
    confidence: number,
    source: IdentityFieldSource,
    now: number,
    reason?: string,
    forceApply = false,
): IdentityField {
    const value = trimText(nextValue, MAX_FIELD_CHARS);
    if (!existing) {
        return { value, confidence: clamp01(confidence), source, updatedAt: now };
    }
    if (normalizeComparable(existing.value) === normalizeComparable(value)) {
        // Restating the confirmed value: reinforce and drop any pending contradiction.
        return {
            value: existing.value,
            confidence: clamp01(Math.max(existing.confidence, confidence)),
            updatedAt: now,
            source: existing.confidence >= confidence ? existing.source : source,
            previousValues: existing.previousValues,
        };
    }

    if (!forceApply) {
        // Never silently overwrite — hold candidate for Settings confirm/dismiss.
        return {
            ...existing,
            pendingCandidate: value,
        };
    }

    const revision: IdentityFieldRevision = {
        value: existing.value,
        confidence: existing.confidence,
        source: existing.source,
        updatedAt: existing.updatedAt,
        invalidatedAt: now,
        reason: reason ?? 'superseded by explicit confirmation',
    };
    const previous = [revision, ...(existing.previousValues ?? [])].slice(0, MAX_PREVIOUS_VALUES);
    return {
        value,
        confidence: clamp01(confidence),
        source,
        updatedAt: now,
        previousValues: previous,
    };
}

function mergePeople(
    existing: readonly IdentityPerson[],
    incoming: readonly { name: string; relation?: string }[],
    confidence: number,
    source: IdentityFieldSource,
    now: number,
): IdentityPerson[] {
    const map = new Map<string, IdentityPerson>();
    existing.forEach((person) => {
        map.set(personKey(person.name), person);
    });

    incoming.forEach((item) => {
        const name = trimText(item.name, 60);
        if (!name) return;
        const key = personKey(name);
        const prev = map.get(key);
        if (prev && !prev.invalidatedAt) {
            map.set(key, {
                ...prev,
                relation: item.relation?.trim()
                    ? trimText(item.relation, 60)
                    : prev.relation,
                confidence: clamp01(Math.max(prev.confidence, confidence)),
                updatedAt: now,
                source: prev.confidence >= confidence ? prev.source : source,
            });
            return;
        }
        map.set(key, {
            name,
            relation: item.relation?.trim() ? trimText(item.relation, 60) : undefined,
            confidence: clamp01(confidence),
            source,
            updatedAt: now,
        });
    });

    return Array.from(map.values())
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_KEY_PEOPLE);
}

function mergeFacts(
    existing: readonly IdentityFact[],
    incoming: readonly string[],
    confidence: number,
    source: IdentityFieldSource,
    now: number,
): IdentityFact[] {
    const map = new Map<string, IdentityFact>();
    existing.forEach((fact) => {
        map.set(fact.id, fact);
    });

    incoming.forEach((raw) => {
        const content = trimText(raw, MAX_FACT_CHARS);
        if (!content) return;
        const id = factId(content);
        const prev = map.get(id);
        if (prev && !prev.invalidatedAt) {
            map.set(id, {
                ...prev,
                confidence: clamp01(Math.max(prev.confidence, confidence)),
                updatedAt: now,
                source: prev.confidence >= confidence ? prev.source : source,
            });
            return;
        }
        map.set(id, {
            id,
            content,
            confidence: clamp01(confidence),
            source,
            updatedAt: now,
        });
    });

    return Array.from(map.values())
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_FACTS);
}

export function profileHasIdentity(profile: IdentityProfile): boolean {
    if (profile.preferredName?.value) return true;
    if (profile.pronouns?.value) return true;
    if (profile.about?.value) return true;
    if (profile.keyPeople.some((p) => !p.invalidatedAt)) return true;
    if (profile.facts.some((f) => !f.invalidatedAt)) return true;
    return false;
}

export function patchIsEmpty(patch: IdentityPatch): boolean {
    if (patch.preferredName?.trim()) return false;
    if (patch.pronouns?.trim()) return false;
    if (patch.about?.trim()) return false;
    if (patch.keyPeople && patch.keyPeople.length > 0) return false;
    if (patch.facts && patch.facts.length > 0) return false;
    return true;
}

/**
 * Apply an identity delta. Concurrent callers serialize via the write lock.
 * Returns the merged profile (or the prior profile if the patch was empty).
 *
 * Extraction/tool: contradicting scalar values become pendingCandidate only.
 * Explicit supersede: patch.forceApply === true, or source === 'manual' (Settings edit).
 */
export async function applyIdentityPatch(patch: IdentityPatch): Promise<IdentityProfile> {
    if (patchIsEmpty(patch)) {
        return loadProfile();
    }

    const profile = await withIdentityLock(async () => {
        const current = await loadProfile();
        const now = Date.now();
        const confidence = clamp01(patch.confidence ?? 0.78);
        const source: IdentityFieldSource = patch.source ?? 'extraction';
        const reason = patch.reason;
        const forceApply = patch.forceApply === true || source === 'manual';

        const next: IdentityProfile = {
            ...current,
            keyPeople: [...current.keyPeople],
            facts: [...current.facts],
            updatedAt: now,
        };

        if (patch.preferredName?.trim()) {
            next.preferredName = mergeField(
                current.preferredName,
                patch.preferredName,
                confidence,
                source,
                now,
                reason,
                forceApply,
            );
        }
        if (patch.pronouns?.trim()) {
            next.pronouns = mergeField(
                current.pronouns,
                patch.pronouns,
                confidence,
                source,
                now,
                reason,
                forceApply,
            );
        }
        if (patch.about?.trim()) {
            next.about = mergeField(
                current.about,
                patch.about,
                Math.min(confidence, 0.85),
                source,
                now,
                reason,
                forceApply,
            );
        }
        if (patch.keyPeople && patch.keyPeople.length > 0) {
            next.keyPeople = mergePeople(current.keyPeople, patch.keyPeople, confidence, source, now);
        }
        if (patch.facts && patch.facts.length > 0) {
            next.facts = mergeFacts(current.facts, patch.facts, confidence, source, now);
        }

        await saveProfile(next);
        return next;
    });

    notifyIdentityChanged();
    return profile;
}

/** Promote pendingCandidate → value (explicit user confirmation). */
export async function confirmIdentityPendingField(
    field: IdentityScalarField,
): Promise<IdentityProfile> {
    const profile = await withIdentityLock(async () => {
        const current = await loadProfile();
        const existing = current[field];
        const candidate = existing?.pendingCandidate?.trim();
        if (!existing || !candidate) {
            return current;
        }
        const now = Date.now();
        const next: IdentityProfile = {
            ...current,
            keyPeople: [...current.keyPeople],
            facts: [...current.facts],
            updatedAt: now,
            [field]: mergeField(
                existing,
                candidate,
                existing.confidence,
                'manual',
                now,
                'user confirmed pending identity candidate',
                true,
            ),
        };
        await saveProfile(next);
        return next;
    });
    notifyIdentityChanged();
    return profile;
}

/** Drop a pending contradiction without changing the active value. */
export async function dismissIdentityPendingField(
    field: IdentityScalarField,
): Promise<IdentityProfile> {
    const profile = await withIdentityLock(async () => {
        const current = await loadProfile();
        const existing = current[field];
        if (!existing?.pendingCandidate) {
            return current;
        }
        const now = Date.now();
        const { pendingCandidate: _drop, ...rest } = existing;
        const next: IdentityProfile = {
            ...current,
            keyPeople: [...current.keyPeople],
            facts: [...current.facts],
            updatedAt: now,
            [field]: { ...rest, updatedAt: now },
        };
        await saveProfile(next);
        return next;
    });
    notifyIdentityChanged();
    return profile;
}

/**
 * Always-injected prompt block. Bypasses capsule ranking entirely.
 * Returns undefined when the profile is empty so we do not burn tokens.
 */
export function formatIdentityContext(profile: IdentityProfile): string | undefined {
    if (!profileHasIdentity(profile)) return undefined;

    const lines: string[] = [
        '## Identity (always-on core memory)',
        'These facts are confirmed on-device about THIS user. Use them naturally (name in greeting, correct pronouns).',
        'Do not invent identity details that are not listed. If a fact conflicts with the live message, trust the live message and treat the stored value as possibly outdated.',
    ];

    if (profile.preferredName?.value) {
        lines.push(`- Preferred name: ${profile.preferredName.value}`);
    }
    if (profile.pronouns?.value) {
        lines.push(`- Pronouns: ${profile.pronouns.value}`);
    }
    if (profile.about?.value) {
        lines.push(`- About: ${profile.about.value}`);
    }

    const people = profile.keyPeople.filter((p) => !p.invalidatedAt).slice(0, 6);
    if (people.length > 0) {
        lines.push(
            `- Key people: ${people.map((p) => (p.relation ? `${p.name} (${p.relation})` : p.name)).join('; ')}`,
        );
    }

    const facts = profile.facts.filter((f) => !f.invalidatedAt).slice(0, 8);
    if (facts.length > 0) {
        facts.forEach((fact) => {
            lines.push(`- Fact: ${fact.content}`);
        });
    }

    let used = 0;
    const out: string[] = [];
    for (const line of lines) {
        if (used + line.length + 1 > MAX_CONTEXT_CHARS && out.length >= 4) break;
        out.push(line);
        used += line.length + 1;
    }
    return out.join('\n');
}

export async function buildIdentityContext(): Promise<string | undefined> {
    const profile = await loadProfile();
    return formatIdentityContext(profile);
}
