import type {
    LocalMemoryAtom,
    LocalMemoryRootSourceKind,
    LocalMemorySource,
} from './localMemory.types';
import type { MemoryGraphAtom } from './memoryGraph.types';

export interface ResolvedRootSource {
    id: string;
    kind: LocalMemoryRootSourceKind;
}

type ProvenanceLike = {
    source: LocalMemorySource;
    sourceId?: string;
    rootSourceId?: string;
    rootSourceKind?: LocalMemoryRootSourceKind;
};

function kindFromSource(source: LocalMemorySource): LocalMemoryRootSourceKind | null {
    switch (source) {
        case 'journal':
            return 'journal_entry';
        case 'intention':
            return 'intention_checkin';
        case 'manual':
            return 'manual';
        case 'system':
            return 'system';
        case 'feedback':
            return 'feedback';
        default:
            return null;
    }
}

/**
 * Composite sourceIds used by the legacy fan-out pipeline:
 *   `{root}:profile`, `{root}:topic:{topic}`
 * Theme/profile merge keys (`theme:…`, `profile:…`) are not navigable roots.
 */
function parseLegacyCompositeSourceId(sourceId: string): string | null {
    if (
        sourceId.startsWith('theme:')
        || sourceId.startsWith('profile:')
        || sourceId.startsWith('note:')
        || sourceId.startsWith('settings:')
    ) {
        return null;
    }

    const profileMatch = sourceId.match(/^(.+):profile$/);
    if (profileMatch?.[1]) return profileMatch[1];

    const topicMatch = sourceId.match(/^(.+):topic:/);
    if (topicMatch?.[1]) return topicMatch[1];

    // Plain entry/check-in id (no composite suffix).
    if (!sourceId.includes(':') || /^[a-z]+_[a-z0-9]+$/i.test(sourceId)) {
        return sourceId;
    }

    // UUID-style without composite: treat whole string as root when no known suffix.
    if (!sourceId.includes(':profile') && !sourceId.includes(':topic:')) {
        return sourceId;
    }

    return null;
}

/**
 * Resolve the navigable root for a stored or graph atom.
 * Prefers explicit rootSource* fields; falls back to legacy sourceId shapes.
 */
export function resolveRootSource(atom: ProvenanceLike): ResolvedRootSource | null {
    if (atom.rootSourceId && atom.rootSourceKind) {
        return { id: atom.rootSourceId, kind: atom.rootSourceKind };
    }

    if (atom.rootSourceId) {
        const kind = atom.rootSourceKind ?? kindFromSource(atom.source);
        if (kind) return { id: atom.rootSourceId, kind };
    }

    if (!atom.sourceId) return null;

    const navigable = kindFromSource(atom.source);
    if (!navigable || navigable === 'manual' || navigable === 'system' || navigable === 'feedback') {
        return null;
    }

    const rootId = parseLegacyCompositeSourceId(atom.sourceId);
    if (!rootId) return null;

    return { id: rootId, kind: navigable };
}

/** Soft-migrate a stored atom: fill root fields and rename generic profile titles. */
export function migrateAtomProvenance(atom: LocalMemoryAtom): LocalMemoryAtom {
    const resolved = resolveRootSource(atom);
    let title = atom.title;

    if (title.trim().toLowerCase() === 'about the user') {
        const stripped = atom.content
            .replace(/^Recent (journal|morning intention|evening reflection|intention) pattern:\s*/i, '')
            .trim();
        title = stripped.slice(0, 72).trim() || 'Recent pattern';
        if (stripped.length > 72) title = `${title}...`;
    }

    if (
        resolved
        && atom.rootSourceId === resolved.id
        && atom.rootSourceKind === resolved.kind
        && title === atom.title
    ) {
        return atom;
    }

    return {
        ...atom,
        title,
        rootSourceId: atom.rootSourceId ?? resolved?.id,
        rootSourceKind: atom.rootSourceKind ?? resolved?.kind,
    };
}

export function isNavigableRootKind(
    kind: LocalMemoryRootSourceKind | undefined
): kind is 'journal_entry' | 'intention_checkin' {
    return kind === 'journal_entry' || kind === 'intention_checkin';
}

export function graphAtomRoot(atom: MemoryGraphAtom): ResolvedRootSource | null {
    return resolveRootSource(atom);
}
