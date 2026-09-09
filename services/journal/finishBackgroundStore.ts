/**
 * In-memory status store for background finish side effects.
 *
 * After Finish, the entry is saved and the user navigates to reflection
 * immediately. Analysis, memory atoms, day digest, identity, session digest
 * and Hindsight retain keep running in the background; this store lets the
 * reflection / memory / insights screens show a thin "Updating memories…"
 * banner and refresh when each step settles.
 *
 * No storage key — this is ephemeral UI state, not persisted data.
 */

export type FinishBackgroundStep =
    | 'analysis'
    | 'memories'
    | 'digest'
    | 'identity'
    | 'sessionDigest'
    | 'hindsight';

export const FINISH_BACKGROUND_STEPS: readonly FinishBackgroundStep[] = [
    'analysis',
    'memories',
    'digest',
    'identity',
    'sessionDigest',
    'hindsight',
];

export interface FinishBackgroundStatus {
    runId: string;
    entryId: string;
    startedAt: number;
    /** Steps that have settled (success or soft-fail). */
    done: Partial<Record<FinishBackgroundStep, boolean>>;
    /** First non-abort error message, if any step failed. */
    error?: string;
}

type FinishBackgroundListener = (status: FinishBackgroundStatus | null) => void;

let currentStatus: FinishBackgroundStatus | null = null;
const listeners = new Set<FinishBackgroundListener>();

export function subscribeFinishBackground(
    listener: FinishBackgroundListener,
): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function getFinishBackgroundStatus(): FinishBackgroundStatus | null {
    return currentStatus;
}

function notifyFinishBackground(): void {
    listeners.forEach((listener) => {
        try {
            listener(currentStatus);
        } catch {
            // A broken listener must never break a settle.
        }
    });
}

/** Registers a new run. Returns the runId. */
export function startFinishBackground(entryId: string): string {
    const runId = `finish-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    currentStatus = {
        runId,
        entryId,
        startedAt: Date.now(),
        done: {},
    };
    notifyFinishBackground();
    return runId;
}

/** Marks one step as settled and notifies listeners. */
export function settleFinishBackground(
    runId: string,
    step: FinishBackgroundStep,
    error?: string,
): void {
    if (!currentStatus || currentStatus.runId !== runId) return;
    currentStatus = {
        ...currentStatus,
        done: { ...currentStatus.done, [step]: true },
        error: currentStatus.error ?? error,
    };
    notifyFinishBackground();
}

/** Clears the current run (used by tests and after the banner auto-hides). */
export function clearFinishBackground(): void {
    if (!currentStatus) return;
    currentStatus = null;
    notifyFinishBackground();
}