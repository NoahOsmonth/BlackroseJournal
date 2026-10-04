/**
 * Entry-level edit and delete side effects (JOURNAL-10 / JOURNAL-11).
 *
 * Two jobs the entry-detail screen must not do itself:
 * - `updateJournalEntryText` — rewrite the authored text of an entry and
 *   refresh its derived artifacts (atoms + day digest) so recall cites the
 *   edited words instead of the original ones.
 * - `deleteJournalEntryWithTombstone` — retire every artifact derived from the
 *   entry (session digest, staged memory files, atoms, day-digest source) and
 *   then drop the entry, so a deleted entry stops being recallable.
 *
 * Doctrine: local-first and soft-fail per step (same shape as
 * `journalFinishSideEffects`). A failing derived artifact must never leave the
 * user staring at an entry they asked to delete — the entry row itself is the
 * only step whose failure is reported to the caller.
 */

import {
    AccountOperationContext,
    assertAccountOperationActive,
    runAccountBoundOperation,
} from '@/services/account/accountRuntime';
import {
    removeDayDigestSource,
    upsertJournalDayDigest,
} from '@/services/memory/dayDigestStorage';
import {
    deleteMemoryAtomsByRootSource,
    saveJournalEntryMemories,
} from '@/services/memory/localMemory';
import { deleteMemoryFilesBySourceSessions } from '@/services/memory/memoryFiles';
import { clearMemoryRecallCache } from '@/services/memory/memoryRetrieval';
import { refreshJournalEntryMemoryFiles } from '@/services/memory/memoryStage';
import { deleteSessionDigest } from '@/services/memory/sessionDigestStorage';
import { rebuildMessagesForEditedText } from '@/utils/entryText';
import { deleteEntry, getEntry, updateEntry } from './journalStorage';
import type { JournalEntry } from './journalStorage.types';

async function runStep(
    label: string,
    operation: () => Promise<unknown>,
    context: AccountOperationContext,
): Promise<void> {
    try {
        assertAccountOperationActive(context);
        await operation();
    } catch (error) {
        if (context.signal.aborted) throw error;
        console.warn(`Entry ${label} step failed:`, error);
    }
}

/**
 * Persist an edited entry body and re-derive its memory artifacts.
 * Returns the stored entry, or null when the entry no longer exists.
 */
export function updateJournalEntryText(
    entryId: string,
    text: string,
): Promise<JournalEntry | null> {
    return runAccountBoundOperation('journal-entry-edit', async (context) => {
        const current = await getEntry(entryId);
        assertAccountOperationActive(context);
        if (!current) return null;

        const next = await updateEntry(entryId, {
            messages: rebuildMessagesForEditedText(current.messages, text),
        });
        assertAccountOperationActive(context);
        if (!next) return null;

        // Derived artifacts refresh: re-extract atoms from the edited text,
        // rewrite the entry's offline memory files in place (recall reads only
        // those files, so without this `memory_search` keeps returning the
        // original text forever), and rewrite the day rollup's snippet. All are
        // upserts/in-place writes, so a failed step cannot erase what the
        // previous version created.
        await runStep('atoms refresh', () => saveJournalEntryMemories(next), context);
        await runStep('memory files refresh', () => refreshJournalEntryMemoryFiles(next), context);
        await runStep('day digest refresh', () => upsertJournalDayDigest(next), context);
        // Recall caches rendered context for 30s (memoryRetrieval). Nothing else
        // invalidates it on a write, so without this the edit is invisible to
        // `memory_search` until the TTL lapses.
        await runStep('recall cache', async () => clearMemoryRecallCache(), context);

        return next;
    });
}

/**
 * Remove an entry and every artifact derived from it (tombstone), so nothing
 * downstream can still recall the deleted session. Returns true when the entry
 * row itself was removed.
 */
export function deleteJournalEntryWithTombstone(entryId: string): Promise<boolean> {
    return runAccountBoundOperation('journal-entry-delete', async (context) => {
        await runStep('session digest', () => deleteSessionDigest(entryId), context);
        await runStep('memory files', () => deleteMemoryFilesBySourceSessions([entryId]), context);
        await runStep('atoms', () => deleteMemoryAtomsByRootSource(entryId), context);
        await runStep('day digest', () => removeDayDigestSource('journal_entry', entryId), context);
        // A deleted entry must stop being recallable immediately, not after the
        // recall cache's 30s TTL.
        await runStep('recall cache', async () => clearMemoryRecallCache(), context);

        const deleted = await deleteEntry(entryId);
        assertAccountOperationActive(context);
        return deleted;
    });
}
