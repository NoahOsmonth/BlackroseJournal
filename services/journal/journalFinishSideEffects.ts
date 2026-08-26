/**
 * Finish-path side effects for a completed journal entry.
 * Keeps app/chat.tsx under design-line limits (UI → services).
 *
 * Soft-fails per step so one failure never blocks Finish navigation. Account
 * switches are different: an aborted finish must stop before another account
 * can observe any later side effect.
 */

import type { JournalEntry } from './journalStorage.types';
import { upsertJournalDayDigest } from '@/services/memory/dayDigestStorage';
import { extractIdentityFromSessionTranscript } from '@/services/memory/identityExtraction';
import { retainJournalEntryToHindsight } from '@/services/memory/hindsight/hindsightRetain';
import { saveJournalEntryMemories } from '@/services/memory/localMemory';
import { buildAndSaveSessionDigest } from '@/services/memory/sessionDigestBuild';
import {
    AccountOperationContext,
    assertAccountOperationActive,
    runAccountBoundOperation,
} from '@/services/account/accountRuntime';

async function runStep(
    label: string,
    operation: () => Promise<unknown>,
    context: AccountOperationContext,
): Promise<void> {
    try {
        assertAccountOperationActive(context);
        await operation();
        assertAccountOperationActive(context);
    } catch (err) {
        if (context.signal.aborted) throw err;
        console.warn(`${label}:`, err);
    }
}

async function runJournalFinishSideEffectsForAccount(
    savedEntry: JournalEntry,
    context: AccountOperationContext,
): Promise<void> {
    await runStep(
        'Failed to save journal memories',
        () => saveJournalEntryMemories(savedEntry),
        context,
    );

    await runStep(
        'Failed to update day digest',
        () => upsertJournalDayDigest(savedEntry),
        context,
    );

    const userLines = savedEntry.messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content);

    await runStep(
        'Identity finish extract failed',
        () => extractIdentityFromSessionTranscript(userLines),
        context,
    );

    await runStep(
        'Session digest finish build failed',
        () => buildAndSaveSessionDigest({
            sessionId: savedEntry.id,
            sourceKind: 'journal_entry',
            sourceId: savedEntry.id,
            userMessages: userLines,
        }),
        context,
    );

    // Fire-and-forget — never block Finish navigation on Hindsight being down.
    // The lease check prevents a queued retain from starting after a switch;
    // a retain already handed to the network has no result callback here.
    assertAccountOperationActive(context);
    void Promise.resolve()
        .then(() => {
            assertAccountOperationActive(context);
            return retainJournalEntryToHindsight(savedEntry);
        })
        .catch((error: unknown) => {
            if (!context.signal.aborted) {
                console.warn('Hindsight retain failed (journal):', error);
            }
        });
}

export function runJournalFinishSideEffects(savedEntry: JournalEntry): Promise<void> {
    return runAccountBoundOperation(
        'journal-finish-side-effects',
        (context) => runJournalFinishSideEffectsForAccount(savedEntry, context),
    );
}
