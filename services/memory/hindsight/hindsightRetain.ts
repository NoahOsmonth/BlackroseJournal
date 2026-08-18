/**
 * Retain builders — map finished journal entries / check-ins to Hindsight
 * observations. User lines + analysis become the memory content; assistant
 * replies are dropped (they are scaffolding, not memory).
 */
import type { Message } from '@/services/ai/chatTypes';
import type { JournalEntry } from '@/services/journal/journalStorage.types';
import type { IntentionCheckIn } from '@/services/intentions/intentionsStorage.types';
import { hindsightRetain, type HindsightRetainItem } from './hindsightClient';

const OBSERVATION_MAX_CHARS = 2000;
const MAX_USER_LINES = 12;

function userContentLines(messages: Message[] | undefined): string[] {
    return (messages ?? [])
        .filter((m) => m.role === 'user')
        .map((m) => m.content.trim())
        .filter((c) => c.length > 0)
        .slice(-MAX_USER_LINES);
}

function buildItem(
    documentId: string,
    timestamp: number,
    parts: (string | undefined)[]
): HindsightRetainItem[] {
    const content = parts.filter(Boolean).join('\n').slice(0, OBSERVATION_MAX_CHARS);
    if (!content.trim()) return [];
    return [{ content, timestamp, document_id: documentId }];
}

export function buildRetainItemsFromJournalEntry(entry: JournalEntry): HindsightRetainItem[] {
    if (entry.status !== 'completed') return [];
    const lines = userContentLines(entry.messages);
    if (lines.length === 0) return [];
    const analysisLine = entry.analysis
        ? `Insight: ${entry.analysis.insight} Topics: ${entry.analysis.topics.join(', ')}`
        : undefined;
    return buildItem(`journal_entry:${entry.id}`, entry.createdAt, [entry.title, ...lines, analysisLine]);
}

export function buildRetainItemsFromCheckIn(checkIn: IntentionCheckIn): HindsightRetainItem[] {
    if (checkIn.status !== 'completed') return [];
    const lines = userContentLines(checkIn.messages);
    if (lines.length === 0 && !checkIn.summary.trim()) return [];
    return buildItem(`intention_checkin:${checkIn.id}`, checkIn.createdAt, [
        checkIn.title,
        checkIn.summary.trim() ? `Summary: ${checkIn.summary}` : undefined,
        ...lines,
    ]);
}

export async function retainJournalEntryToHindsight(entry: JournalEntry): Promise<boolean> {
    return hindsightRetain(buildRetainItemsFromJournalEntry(entry));
}

export async function retainCheckInToHindsight(checkIn: IntentionCheckIn): Promise<boolean> {
    return hindsightRetain(buildRetainItemsFromCheckIn(checkIn));
}
