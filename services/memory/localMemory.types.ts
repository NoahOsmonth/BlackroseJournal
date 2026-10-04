import type { StorageAdapter } from '@/services/journal/journalStorage.types';

export type LocalMemoryLayer =
    | 'working'
    | 'episodic'
    | 'semantic'
    | 'procedural'
    | 'profile'
    | 'note';

export type LocalMemorySource = 'journal' | 'intention' | 'feedback' | 'manual' | 'system';

/** Navigable provenance for opening journal/check-in detail from the graph. */
export type LocalMemoryRootSourceKind =
    | 'journal_entry'
    | 'intention_checkin'
    | 'manual'
    | 'system'
    | 'feedback';

export interface LocalMemoryAtom {
    id: string;
    layer: LocalMemoryLayer;
    source: LocalMemorySource;
    sourceId?: string;
    /** Navigable journal entry id or check-in id when known. */
    rootSourceId?: string;
    rootSourceKind?: LocalMemoryRootSourceKind;
    title: string;
    content: string;
    tags: string[];
    salience: number;
    confidence: number;
    createdAt: number;
    updatedAt: number;
    lastAccessedAt?: number;
    accessCount: number;
    /**
     * Absolute ISO date (YYYY-MM-DD) of a specific datable event in this atom,
     * when extraction resolved one. Absent/null on undatable or older atoms.
     */
    eventDate?: string | null;
    /**
     * Declared importance (0..1) — the extractor's own judgement, captured at the
     * first write and raised (never lowered) when a later write declares more.
     * Deliberately NOT inflated by re-writes: the recurrence bonus lives on
     * `salience` (see `mergeAtom`), so the profile cap can rank by what matters
     * rather than by how often a topic was written about.
     */
    importance?: number;
    /**
     * Epoch ms when the profile cap retired this atom. Retired atoms are kept in
     * storage (and therefore in a backup bundle) and filtered out of every read
     * path — the soft-delete `memoryFiles.ts` does with `deprecated` and
     * `identityProfile.ts` does with `invalidatedAt`. A re-write clears it.
     */
    retiredAt?: number;
}

export interface LocalMemoryAtomInput {
    layer: LocalMemoryLayer;
    source: LocalMemorySource;
    sourceId: string;
    rootSourceId?: string;
    rootSourceKind?: LocalMemoryRootSourceKind;
    title: string;
    content: string;
    tags?: string[];
    salience?: number;
    confidence?: number;
    createdAt?: number;
    eventDate?: string | null;
}

export interface LocalMemoryEnvelope {
    schemaVersion: number;
    atoms: Record<string, LocalMemoryAtom>;
}

export interface LocalMemoryPromptOptions {
    query?: string;
    limit?: number;
    now?: number;
}

export type LocalMemoryStorageAdapter = StorageAdapter;
