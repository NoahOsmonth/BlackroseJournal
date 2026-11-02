import { useCallback, useEffect, useMemo, useState } from 'react';

import {
    CrashLogRecord,
    clearCrashLogs,
    loadCrashLogState,
    markCrashLogsSeen,
} from '@/services/crash/crashLogStorage';
import { countUnseenCrashes } from '@/services/crash/crashReport';

export interface UseCrashLogsResult {
    readonly records: readonly CrashLogRecord[];
    readonly unseenCount: number;
    readonly isLoading: boolean;
    readonly error: string | null;
    readonly refresh: () => Promise<void>;
    readonly markSeen: () => Promise<void>;
    readonly clear: () => Promise<void>;
}

/** Reads the on-device crash log store. All I/O for the crash-log screen. */
export function useCrashLogs(): UseCrashLogsResult {
    const [records, setRecords] = useState<readonly CrashLogRecord[]>([]);
    const [lastSeenAt, setLastSeenAt] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        try {
            const state = await loadCrashLogState();
            setRecords(state.records);
            setLastSeenAt(state.lastSeenAt);
            setError(null);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not read crash logs.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const markSeen = useCallback(async () => {
        setLastSeenAt(Date.now());
        try {
            await markCrashLogsSeen();
        } catch (cause) {
            console.warn('[crash] Could not mark crash logs as seen:', cause);
        }
    }, []);

    const clear = useCallback(async () => {
        await clearCrashLogs();
        setRecords([]);
        setLastSeenAt(0);
    }, []);

    const unseenCount = useMemo(
        () => countUnseenCrashes({ records, lastSeenAt }),
        [records, lastSeenAt],
    );

    return { records, unseenCount, isLoading, error, refresh, markSeen, clear };
}
