/**
 * Finish-path side effects for a completed journal entry.
 * Keeps app/chat.tsx under design-line limits (UI → services).
 *
 * Two entry points:
 * - `runJournalFinishSideEffects` — sequential, awaited by tests and legacy
 *   callers. Soft-fails per step so one failure never blocks Finish
 *   navigation. Account switches are different: an aborted finish must stop
 *   before another account can observe any later side effect.
 * - `runJournalFinishBackground` — the production path. Saves the entry first,
 *   navigates immediately, then runs analysis + memory side effects in the
 *   background (parallel, per-step timeout, never rejects). Progress is
 *   published to `finishBackgroundStore` so screens can show a status banner.
 */

import {
    AccountOperationContext,
    assertAccountOperationActive,
    runAccountBoundOperation,
} from '@/services/account/accountRuntime';
import { generateEntryAnalysis } from '@/services/ai';
import { upsertJournalDayDigest } from '@/services/memory/dayDigestStorage';
import { retainJournalEntryToHindsight } from '@/services/memory/hindsight/hindsightRetain';
import { extractIdentityFromSessionTranscript } from '@/services/memory/identityExtraction';
import { saveJournalEntryMemories } from '@/services/memory/localMemory';
import { buildAndSaveSessionDigest } from '@/services/memory/sessionDigestBuild';
import {
    FinishBackgroundStep,
    settleFinishBackground,
    startFinishBackground,
} from './finishBackgroundStore';
import { updateEntry } from './journalStorage';
import type { JournalEntry, JournalEntryAnalysis } from './journalStorage.types';

/** Per-step ceiling so one hung LLM call can never pin the banner forever. */
const STEP_TIMEOUT_MS = 30_000;

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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timed out after ${ms}ms`));
        }, ms);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (err) => {
                clearTimeout(timer);
                reject(err);
            },
        );
    });
}

function errorMessage(err: unknown): string | undefined {
    if (err instanceof Error && err.message) return err.message;
    return undefined;
}

/**
 * Runs one background step with a timeout and publishes its settle to the
 * store. Aborts settle softly (no scary error) — an account switch mid-run is
 * expected, not a failure.
 */
async function runBackgroundStep(
    runId: string,
    step: FinishBackgroundStep,
    label: string,
    operation: () => Promise<unknown>,
    context: AccountOperationContext,
): Promise<void> {
    try {
        assertAccountOperationActive(context);
        await withTimeout(operation(), STEP_TIMEOUT_MS);
        assertAccountOperationActive(context);
        settleFinishBackground(runId, step);
    } catch (err) {
        if (context.signal.aborted) {
            settleFinishBackground(runId, step);
            return;
        }
        console.warn(`${label}:`, err);
        settleFinishBackground(runId, step, errorMessage(err));
    }
}

/**
 * Generates the entry analysis in the background and persists it onto the
 * saved entry so the reflection / detail screens pick it up on refresh.
 */
async function runAnalysisStep(
    runId: string,
    savedEntry: JournalEntry,
    context: AccountOperationContext,
): Promise<void> {
    const entryText = savedEntry.messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join('\n\n');
    if (!entryText.trim()) {
        settleFinishBackground(runId, 'analysis');
        return;
    }
    try {
        assertAccountOperationActive(context);
        const generated = await withTimeout(
            generateEntryAnalysis({ entryText }),
            STEP_TIMEOUT_MS,
        );
        assertAccountOperationActive(context);
        const analysis: JournalEntryAnalysis = { ...generated, generatedAt: Date.now() };
        await updateEntry(savedEntry.id, { analysis });
        settleFinishBackground(runId, 'analysis');
    } catch (err) {
        if (context.signal.aborted) {
            settleFinishBackground(runId, 'analysis');
            return;
        }
        console.warn('Failed to generate entry analysis in background:', err);
        settleFinishBackground(runId, 'analysis', errorMessage(err));
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

export interface JournalFinishBackgroundHandle {
    runId: string;
    /** Resolves when every background step has settled. Never rejects. */
    promise: Promise<void>;
}

/**
 * Production finish path: runs analysis + memory side effects in the
 * background after the entry is saved. Never rejects — the caller navigates
 * immediately and the banner reflects progress via `finishBackgroundStore`.
 */
export function runJournalFinishBackground(
    savedEntry: JournalEntry,
): JournalFinishBackgroundHandle {
    const runId = startFinishBackground(savedEntry.id);
    const promise = runAccountBoundOperation(
        'journal-finish-background',
        async (context) => {
            const userLines = savedEntry.messages
                .filter((m) => m.role === 'user')
                .map((m) => m.content);

            const steps: Array<{
                step: FinishBackgroundStep;
                label: string;
                operation: () => Promise<unknown>;
            }> = [
                {
                    step: 'analysis',
                    label: 'Failed to generate entry analysis in background',
                    operation: () => runAnalysisStep(runId, savedEntry, context),
                },
                {
                    step: 'memories',
                    label: 'Failed to save journal memories',
                    operation: () => saveJournalEntryMemories(savedEntry),
                },
                {
                    step: 'digest',
                    label: 'Failed to update day digest',
                    operation: () => upsertJournalDayDigest(savedEntry),
                },
                {
                    step: 'identity',
                    label: 'Identity finish extract failed',
                    operation: () => extractIdentityFromSessionTranscript(userLines),
                },
                {
                    step: 'sessionDigest',
                    label: 'Session digest finish build failed',
                    operation: () => buildAndSaveSessionDigest({
                        sessionId: savedEntry.id,
                        sourceKind: 'journal_entry',
                        sourceId: savedEntry.id,
                        userMessages: userLines,
                    }),
                },
            ];

            await Promise.allSettled(
                steps.map(({ step, label, operation }) => (
                    runBackgroundStep(runId, step, label, operation, context)
                )),
            );

            // Hindsight retain is soft-fail and never blocks navigation (the
            // caller fires the whole background run without awaiting it), but
            // the run's promise waits for it so the banner reflects true
            // completion. The lease check prevents a queued retain from
            // starting after a switch.
            try {
                assertAccountOperationActive(context);
                await withTimeout(
                    retainJournalEntryToHindsight(savedEntry),
                    STEP_TIMEOUT_MS,
                );
                settleFinishBackground(runId, 'hindsight');
            } catch (error: unknown) {
                if (!context.signal.aborted) {
                    console.warn('Hindsight retain failed (journal):', error);
                }
                settleFinishBackground(runId, 'hindsight', errorMessage(error));
            }
        },
    );

    return { runId, promise };
}
