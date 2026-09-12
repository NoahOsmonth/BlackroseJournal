import { useEffect, useRef } from 'react';

import { useFinishBackgroundStatus } from './useFinishBackgroundStatus';

/**
 * Calls `refresh` exactly once per completed finish-background run.
 *
 * The finish store keeps a settled run in memory, so an effect keyed on
 * `isDone` alone re-fires whenever one of its dependencies changes identity.
 * That is how the reflection screen ended up calling `generateEntryReflection`
 * on every render and queuing thousands of AI requests. Guarding on the run id
 * makes the effect idempotent no matter how unstable `refresh` is.
 *
 * `entryId` (optional) limits the refresh to runs that finished that entry.
 */
export function useRefreshOnFinishRun(refresh: () => void, entryId?: string): void {
    const { status, isDone } = useFinishBackgroundStatus();
    const handledRunIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!isDone || !status) return;
        if (entryId && status.entryId !== entryId) return;
        if (handledRunIdRef.current === status.runId) return;
        handledRunIdRef.current = status.runId;
        refresh();
    }, [isDone, status, entryId, refresh]);
}
