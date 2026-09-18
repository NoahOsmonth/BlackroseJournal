/**
 * Module-level chat turn activity.
 *
 * Both chat surfaces run on one engine (`streamChat`), so one counter covers
 * them. Non-React services consult this to avoid doing heavy work mid-stream —
 * currently the idle memory Dream trigger, which must never run while a turn is
 * streaming (rule 5: change the shared engine, not one surface).
 */

let inFlightTurns = 0;

const idleListeners = new Set<() => void>();

export function beginChatTurn(): void {
    inFlightTurns += 1;
}

export function endChatTurn(): void {
    inFlightTurns = Math.max(0, inFlightTurns - 1);
    if (inFlightTurns > 0) return;
    idleListeners.forEach((listener) => {
        try {
            listener();
        } catch {
            // A listener must never break the chat path.
        }
    });
}

export function isChatTurnInFlight(): boolean {
    return inFlightTurns > 0;
}

/** Fires when the last in-flight turn finishes. Used to re-arm deferred work. */
export function subscribeChatTurnIdle(listener: () => void): () => void {
    idleListeners.add(listener);
    return () => {
        idleListeners.delete(listener);
    };
}

/** Test helper — never called from app code. */
export function resetChatTurnActivity(): void {
    inFlightTurns = 0;
    idleListeners.clear();
}
