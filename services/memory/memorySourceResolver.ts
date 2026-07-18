import { getEntry } from '@/services/journal/journalStorage';
import { getCheckIn, getIntention } from '@/services/intentions/intentionsStorage';
import type { Message } from '@/services/ai/chatTypes';
import type { MemoryGraphAtom, MemorySourcePreview } from './memoryGraph.types';
import { isNavigableRootKind, resolveRootSource } from './memoryProvenance';

function firstUserSnippet(messages: readonly Message[] | undefined, fallback = ''): string {
    const user = (messages ?? []).find((message) => message.role === 'user');
    const text = (user?.content ?? fallback).trim().replace(/\s+/g, ' ');
    if (!text) return '';
    return text.length > 140 ? `${text.slice(0, 140).trim()}...` : text;
}

function formatDateLabel(timestamp: number): string {
    try {
        return new Date(timestamp).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    } catch {
        return '';
    }
}

/**
 * Resolve a graph atom to a preview of its originating conversation.
 * Returns null when the source was deleted or the atom is not conversation-backed.
 */
export async function resolveMemorySource(
    atom: MemoryGraphAtom
): Promise<MemorySourcePreview | null> {
    const root = resolveRootSource(atom);
    if (!root || !isNavigableRootKind(root.kind)) {
        return null;
    }

    if (root.kind === 'journal_entry') {
        const entry = await getEntry(root.id);
        if (!entry) return null;
        return {
            kind: 'journal_entry',
            id: entry.id,
            title: entry.title || 'Journal entry',
            emoji: entry.emoji,
            dateLabel: formatDateLabel(entry.createdAt),
            mood: entry.analysis?.mood,
            snippet: firstUserSnippet(entry.messages),
            messageCount: entry.messages?.length ?? 0,
        };
    }

    const checkIn = await getCheckIn(root.id);
    if (!checkIn) return null;

    let intentionTitle: string | undefined;
    if (checkIn.intentionId) {
        const intention = await getIntention(checkIn.intentionId);
        intentionTitle = intention?.title;
    }

    return {
        kind: 'intention_checkin',
        id: checkIn.id,
        title: checkIn.title || 'Check-in',
        dateLabel: formatDateLabel(checkIn.createdAt),
        mood: checkIn.mood,
        snippet: firstUserSnippet(checkIn.messages, checkIn.summary),
        messageCount: checkIn.messages?.length ?? 0,
        intentionTitle,
    };
}
