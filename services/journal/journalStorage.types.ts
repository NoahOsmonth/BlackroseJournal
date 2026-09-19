/**
 * Journal Entry Storage Types
 * Defines data models for journal entries (completed and drafts)
 */

import { Message } from '../ai/ai';

export type EntryStatus = 'draft' | 'completed';

export interface JournalEntryAnalysis {
    insight: string;
    quote: string;
    mood: string;
    topics: string[];
    generatedAt: number;
}

/**
 * Where an entry was written. Absent on entries saved before this field existed,
 * so every reader treats `undefined` as `'chat'` — the journal was the only
 * writer until Explore gained a composer.
 */
export type NoteOrigin = 'chat' | 'threads';

export interface JournalEntry {
    id: string;
    title: string;
    emoji: string;
    messages: Message[];
    status: EntryStatus;
    analysis?: JournalEntryAnalysis;
    createdAt: number;
    updatedAt: number;
    /** Compact mirror cursor; source-owner persistence arrives in Phase 1 Task 8. */
    sourceRevision?: number;
    /** Where this entry was written. Absent on older entries → read as 'chat'. */
    origin?: NoteOrigin;
}

export interface JournalEntryCreateInput {
    title?: string;
    emoji?: string;
    messages: Message[];
    status: EntryStatus;
    analysis?: JournalEntryAnalysis;
    /** Optional override (seed demo uses daysAgo offsets). Defaults to now. */
    createdAt?: number;
    updatedAt?: number;
    origin?: NoteOrigin;
}

export interface JournalEntryUpdateInput {
    title?: string;
    emoji?: string;
    messages?: Message[];
    status?: EntryStatus;
    analysis?: JournalEntryAnalysis;
}

export interface StorageAdapter {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}
