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

export interface LocalMemoryAtom {
    id: string;
    entryId: string;
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
    atoms: LocalMemoryAtom[];
    connections: MemoryConnection[];
}
