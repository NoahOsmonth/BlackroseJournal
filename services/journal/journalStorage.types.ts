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

export interface JournalEntry {
    id: string;
    title: string;
    emoji: string;
    messages: Message[];
    status: EntryStatus;
    analysis?: JournalEntryAnalysis;
    createdAt: number;
    updatedAt: number;
}

export interface JournalEntryCreateInput {
    title?: string;
    emoji?: string;
    messages: Message[];
    status: EntryStatus;
    analysis?: JournalEntryAnalysis;
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
