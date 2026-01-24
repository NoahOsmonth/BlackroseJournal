import { Message } from '@/services/ai/ai';
import { ensureSupabaseSession } from '@/services/supabase/supabaseClient';
import { enqueueSyncTask } from '@/services/supabase/syncQueue';
import { logSupabaseError } from '@/services/supabase/supabaseErrors';
import { EntryStatus, JournalEntry } from './journalStorage.types';

const JOURNAL_TABLE = 'journal_entries';

interface JournalEntryRecord {
    id: string;
    title: string;
    emoji: string;
    status: EntryStatus;
    messages: Message[];
    word_count: number;
    message_count: number;
    created_at: string;
    updated_at: string;
}

function countWords(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
}

function computeWordCount(messages: Message[]): number {
    return messages
        .filter(message => message.role === 'user')
        .reduce((total, message) => total + countWords(message.content), 0);
}

function buildJournalRecord(entry: JournalEntry): JournalEntryRecord {
    const createdAt = new Date(entry.createdAt).toISOString();
    const updatedAt = new Date(entry.updatedAt).toISOString();

    return {
        id: entry.id,
        title: entry.title,
        emoji: entry.emoji,
        status: entry.status,
        messages: entry.messages,
        word_count: computeWordCount(entry.messages),
        message_count: entry.messages.length,
        created_at: createdAt,
        updated_at: updatedAt,
    };
}

function parseTimestamp(value: unknown): number {
    if (typeof value === 'string' || typeof value === 'number') {
        const time = new Date(value).getTime();
        return Number.isNaN(time) ? Date.now() : time;
    }

    return Date.now();
}

function coerceMessages(value: unknown): Message[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((message) => message && typeof message === 'object') as Message[];
}

export function mapRemoteEntry(record: JournalEntryRecord): JournalEntry {
    return {
        id: record.id,
        title: record.title ?? 'Untitled',
        emoji: record.emoji ?? '??',
        status: record.status ?? 'draft',
        messages: coerceMessages(record.messages),
        createdAt: parseTimestamp(record.created_at),
        updatedAt: parseTimestamp(record.updated_at),
    };
}

export async function queueJournalEntryUpsert(entry: JournalEntry): Promise<void> {
    const payload = buildJournalRecord(entry);

    await enqueueSyncTask({
        table: JOURNAL_TABLE,
        operation: 'upsert',
        payload,
        onConflict: 'id',
        dedupeKey: `${JOURNAL_TABLE}:${entry.id}`,
    });
}

export async function queueJournalEntryDelete(entryId: string): Promise<void> {
    await enqueueSyncTask({
        table: JOURNAL_TABLE,
        operation: 'delete',
        primaryKey: 'id',
        primaryValue: entryId,
        dedupeKey: `${JOURNAL_TABLE}:${entryId}`,
    });
}

export async function fetchRemoteJournalEntries(): Promise<JournalEntry[] | null> {
    const client = await ensureSupabaseSession();
    if (!client) {
        return null;
    }

    const { data, error } = await client
        .from(JOURNAL_TABLE)
        .select('*')
        .order('updated_at', { ascending: false });

    if (error || !data) {
        if (error) {
            logSupabaseError('Failed to load remote journal entries', JOURNAL_TABLE, error.message);
        }
        return null;
    }

    return data
        .filter((row): row is JournalEntryRecord => Boolean(row && row.id))
        .map(mapRemoteEntry);
}

export function mergeEntries(
    localMap: Record<string, JournalEntry>,
    remoteEntries: JournalEntry[]
): Record<string, JournalEntry> {
    const merged = { ...localMap };

    remoteEntries.forEach((entry) => {
        const existing = merged[entry.id];
        if (!existing || entry.updatedAt >= existing.updatedAt) {
            merged[entry.id] = entry;
        }
    });

    return merged;
}

export async function pushJournalEntries(entries: JournalEntry[]): Promise<boolean> {
    if (entries.length === 0) {
        return true;
    }

    const client = await ensureSupabaseSession();
    if (!client) {
        return false;
    }

    const payload = entries.map(buildJournalRecord);
    const { error } = await client
        .from(JOURNAL_TABLE)
        .upsert(payload, { onConflict: 'id' });

    if (error) {
        logSupabaseError('Failed to push journal entries', JOURNAL_TABLE, error.message);
        return false;
    }

    return true;
}
