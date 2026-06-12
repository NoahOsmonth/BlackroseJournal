import type { StorageAdapter } from '@/services/journal/journalStorage.types';

export type LocalMemoryLayer =
    | 'working'
    | 'episodic'
    | 'semantic'
    | 'procedural'
    | 'profile'
    | 'note';

export type LocalMemorySource = 'journal' | 'intention' | 'feedback' | 'manual' | 'system';

export interface LocalMemoryAtom {
    id: string;
    layer: LocalMemoryLayer;
    source: LocalMemorySource;
    sourceId?: string;
    title: string;
    content: string;
    tags: string[];
    salience: number;
    confidence: number;
    createdAt: number;
    updatedAt: number;
    lastAccessedAt?: number;
    accessCount: number;
}

export interface LocalMemoryAtomInput {
    layer: LocalMemoryLayer;
    source: LocalMemorySource;
    sourceId: string;
    title: string;
    content: string;
    tags?: string[];
    salience?: number;
    confidence?: number;
    createdAt?: number;
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
