import type {
    LocalMemoryRootSourceKind,
    LocalMemorySource,
} from './localMemory.types';

export type MemoryLayer =
    | 'episodic'
    | 'semantic'
    | 'profile'
    | 'procedural'
    | 'note'
    | 'working';

export interface JournalEntry {
    id: string;
    title?: string;
    content: string;
    createdAt: string;
}

// Display model for the memory graph. NOT the stored atom:
// createdAt is an ISO string and salience is on a 1-10 display scale,
// converted from the stored 0-1 scale in useMemoryGraph's toGraphAtom().
// Never write a MemoryGraphAtom back to storage.
export interface MemoryGraphAtom {
    id: string;
    /** @deprecated Prefer rootSourceId — kept for older callers/tests. */
    entryId: string;
    source: LocalMemorySource;
    sourceId?: string;
    rootSourceId?: string;
    rootSourceKind?: LocalMemoryRootSourceKind;
    title: string;
    content: string;
    layer: MemoryLayer;
    salience: number;
    confidence: number;
    tags: string[];
    createdAt: string;
}

export interface MemoryConnection {
    from: string;
    to: string;
    strength: number;
    tags: string[];
}

export interface MemoryGraphData {
    atoms: MemoryGraphAtom[];
    connections: MemoryConnection[];
}

export interface MemorySourcePreview {
    kind: 'journal_entry' | 'intention_checkin';
    id: string;
    title: string;
    emoji?: string;
    dateLabel: string;
    mood?: string;
    snippet: string;
    messageCount: number;
    intentionTitle?: string;
}
