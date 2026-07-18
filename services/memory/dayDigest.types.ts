import type { StorageAdapter } from '@/services/journal/journalStorage.types';

export type DayDigestSourceKind = 'journal_entry' | 'intention_checkin';

export interface DayDigestSource {
    kind: DayDigestSourceKind;
    id: string;
    title: string;
    mode?: string;
}

export interface DayDigest {
    dateKey: string;
    summary: string;
    topics: string[];
    sources: DayDigestSource[];
    entryCount: number;
    updatedAt: number;
    /** How the summary was produced. */
    schemaNote?: 'extractive' | 'llm';
}

export interface DayDigestEnvelope {
    schemaVersion: number;
    days: Record<string, DayDigest>;
}

export interface DayDigestListOptions {
    from?: string;
    to?: string;
    limit?: number;
    now?: number;
    /** Sort order. Default 'newest' (dateKey descending). */
    order?: 'newest' | 'oldest';
}

export interface DayDigestPromptOptions {
    /** Number of most recent active days to include. */
    days?: number;
    now?: number;
}

export type DayDigestStorageAdapter = StorageAdapter;
