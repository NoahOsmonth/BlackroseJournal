/**
 * R1 — idle Dream trigger.
 *
 * `memory_dream` used to be reachable only when the model called the tool, so
 * staged `_tmp` memory files could sit unconsolidated forever while recall
 * leaned on its recency fallback. This module runs the same Dream
 * (`runMemoryDream`) on its own, under three rules:
 *
 *   1. **Single-flight** — one Dream at a time; concurrent callers join the run
 *      in progress instead of starting a second consolidation.
 *   2. **Never during a streaming turn** — a chat turn in flight defers the
 *      run (`services/ai/chatTurnActivity`), it never pre-empts or interleaves.
 *   3. **Foreground only** — the deferred timer exists only while the app is
 *      active and is cleared the moment it backgrounds, so nothing polls in the
 *      background.
 *
 * Everything is soft-fail: Dream already falls back to a deterministic offline
 * plan, and a throw here must not reach the chat or finish paths.
 */

import { isChatTurnInFlight } from '@/services/ai/chatTurnActivity';

import { runMemoryDream, type DreamOutcome } from './memoryDream';
import { listTmpFiles } from './memoryFiles';

/** Below this backlog, promotion is not worth a run. */
export const DREAM_MIN_STAGED_FILES = 3;
/** Idle time after the last activity before Dream runs. */
export const DREAM_IDLE_DELAY_MS = 45_000;

type Timer = ReturnType<typeof setTimeout>;

export type DreamSkipReason =
    | 'backgrounded'
    | 'turn-in-flight'
    | 'below-threshold'
    | 'already-running'
    | 'no-backlog';

export interface DreamTriggerState {
    foreground: boolean;
    scheduled: boolean;
    running: boolean;
    runs: number;
    lastSkipReason: DreamSkipReason | null;
    lastOutcome: DreamOutcome | null;
}

let foreground = true;
let pendingTimer: Timer | null = null;
let inFlight: Promise<DreamOutcome | null> | null = null;
let runs = 0;
let lastSkipReason: DreamSkipReason | null = null;
let lastOutcome: DreamOutcome | null = null;

const outcomeListeners = new Set<(outcome: DreamOutcome) => void>();

/** Telemetry surface (settings screen / probes) — no product behaviour. */
export function subscribeDreamOutcomes(listener: (outcome: DreamOutcome) => void): () => void {
    outcomeListeners.add(listener);
    return () => {
        outcomeListeners.delete(listener);
    };
}

export function getDreamTriggerState(): DreamTriggerState {
    return {
        foreground,
        scheduled: pendingTimer !== null,
        running: inFlight !== null,
        runs,
        lastSkipReason,
        lastOutcome,
    };
}

function clearPending(): void {
    if (pendingTimer === null) return;
    clearTimeout(pendingTimer);
    pendingTimer = null;
}

/**
 * Host hook reports foreground/background. Backgrounding cancels the deferred
 * run: no timer survives off-screen.
 */
export function setDreamForeground(active: boolean): void {
    foreground = active;
    if (!active) {
        clearPending();
        lastSkipReason = 'backgrounded';
    }
}

/**
 * Defer a Dream run to a single idle deadline from now. Called on app
 * foreground, on memory writes, and when a streaming turn ends.
 */
export function noteDreamActivity(): void {
    if (!foreground) return;
    clearPending();
    pendingTimer = setTimeout(() => {
        pendingTimer = null;
        void maybeRunIdleDream();
    }, DREAM_IDLE_DELAY_MS);
}

/** The gated body. Runs at most once per reserved slot. */
async function performGatedDream(): Promise<DreamOutcome | null> {
    if (!foreground) {
        lastSkipReason = 'backgrounded';
        return null;
    }
    if (isChatTurnInFlight()) {
        lastSkipReason = 'turn-in-flight';
        return null;
    }

    const staged = await listTmpFiles().catch(() => []);
    if (staged.length === 0) {
        lastSkipReason = 'no-backlog';
        return null;
    }
    if (staged.length < DREAM_MIN_STAGED_FILES) {
        lastSkipReason = 'below-threshold';
        return null;
    }

    runs += 1;
    lastSkipReason = null;
    try {
        const outcome = await runMemoryDream({ tryLlm: true });
        lastOutcome = outcome;
        outcomeListeners.forEach((listener) => {
            try {
                listener(outcome);
            } catch {
                // Telemetry must not break consolidation.
            }
        });
        return outcome;
    } catch (error: unknown) {
        console.warn('Idle memory Dream failed:', error);
        return null;
    }
}

/**
 * Gate + run. Returns the shared in-flight run when one exists, otherwise the
 * new run, or null when the gate declined (see `lastSkipReason`).
 *
 * The slot is reserved **synchronously**: the gate reads storage, so an await
 * between the check and the reservation let two concurrent callers both pass
 * the gate and consolidate twice.
 */
export async function maybeRunIdleDream(): Promise<DreamOutcome | null> {
    if (inFlight) {
        lastSkipReason = 'already-running';
        return inFlight;
    }

    const reserved = performGatedDream();
    inFlight = reserved;
    try {
        return await reserved;
    } finally {
        if (inFlight === reserved) inFlight = null;
    }
}

/** Test helper — never called from app code. */
export function resetDreamTrigger(): void {
    clearPending();
    inFlight = null;
    runs = 0;
    lastSkipReason = null;
    lastOutcome = null;
    foreground = true;
    outcomeListeners.clear();
}
