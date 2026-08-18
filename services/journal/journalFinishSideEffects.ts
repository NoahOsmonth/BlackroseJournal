/**
 * Finish-path side effects for a completed journal entry.
 * Keeps app/chat.tsx under design-line limits (UI → services).
 *
 * Soft-fails per step so one failure never blocks Finish navigation.
 */

import type { JournalEntry } from './journalStorage.types';
import { upsertJournalDayDigest } from '@/services/memory/dayDigestStorage';
import { extractIdentityFromSessionTranscript } from '@/services/memory/identityExtraction';
import { retainJournalEntryToHindsight } from '@/services/memory/hindsight/hindsightRetain';
import { saveJournalEntryMemories } from '@/services/memory/localMemory';
import { buildAndSaveSessionDigest } from '@/services/memory/sessionDigestBuild';

export async function runJournalFinishSideEffects(savedEntry: JournalEntry): Promise<void> {
    try {
        await saveJournalEntryMemories(savedEntry);
    } catch (err) {
        console.warn('Failed to save journal memories:', err);
    }

    try {
        await upsertJournalDayDigest(savedEntry);
    } catch (err) {
        console.warn('Failed to update day digest:', err);
    }

    const userLines = savedEntry.messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content);

    try {
        await extractIdentityFromSessionTranscript(userLines);
    } catch (err) {
        console.warn('Identity finish extract failed:', err);
    }

    try {
        await buildAndSaveSessionDigest({
            sessionId: savedEntry.id,
            sourceKind: 'journal_entry',
            sourceId: savedEntry.id,
            userMessages: userLines,
        });
    } catch (err) {
        console.warn('Session digest finish build failed:', err);
    }

    // Fire-and-forget — never block Finish navigation on Hindsight being down.
    void retainJournalEntryToHindsight(savedEntry).catch((error) => {
        console.warn('Hindsight retain failed (journal):', error);
    });
}
