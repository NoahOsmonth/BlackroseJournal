/**
 * Hosts the idle memory Dream trigger for the running app.
 *
 * Deliberately event-driven, never a polling loop: it re-arms one deferred
 * deadline on foreground, on memory writes, and when a streaming turn ends, and
 * clears that deadline when the app backgrounds. The gate itself lives in
 * `services/memory/memoryDreamTrigger`.
 */

import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { subscribeChatTurnIdle } from '@/services/ai/chatTurnActivity';
import { subscribeMemoryChanges } from '@/services/memory/localMemory';
import {
    noteDreamActivity,
    resetDreamTrigger,
    setDreamForeground,
} from '@/services/memory/memoryDreamTrigger';

export function useIdleDreamTrigger(enabled = true): void {
    useEffect(() => {
        if (!enabled) return;

        const applyAppState = (state: AppStateStatus): void => {
            const active = state === 'active';
            setDreamForeground(active);
            if (active) noteDreamActivity();
        };

        applyAppState(AppState.currentState);

        const appStateSub = AppState.addEventListener('change', applyAppState);
        // Finished entries write atoms, which is the event the app already uses
        // to refresh digest-driven UI — good enough as a "memory changed" edge.
        const memoryUnsub = subscribeMemoryChanges(() => noteDreamActivity());
        const turnUnsub = subscribeChatTurnIdle(() => noteDreamActivity());

        return () => {
            turnUnsub();
            memoryUnsub();
            appStateSub.remove();
            setDreamForeground(false);
            resetDreamTrigger();
        };
    }, [enabled]);
}
