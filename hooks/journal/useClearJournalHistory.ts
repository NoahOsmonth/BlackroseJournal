import { useCallback, useState } from 'react';

import { clearCachedInsights } from '@/services/insights/weeklyInsightsStorage';
import { clearSavedInsights } from '@/services/saved-insights/savedInsightsStorage';
import { clearDayDigests } from '@/services/memory/dayDigestStorage';
import { clearIdentityProfile } from '@/services/memory/identityProfile';
import { deleteMemoryAtomsBySource } from '@/services/memory/localMemory';
import { clearSessionDigests } from '@/services/memory/sessionDigestStorage';
import { clearMemoryRollups } from '@/services/memory/memoryRollupStorage';
import { clearRollupAttempts } from '@/services/memory/memoryRollupBuild';
import { clearMemoryFiles } from '@/services/memory/memoryFiles';
import { removeAllChatSessions } from '@/services/ai/sessionStorage';
import { clearAllEntries } from '@/services/journal/journalStorage';
import { clearAllCheckIns } from '@/services/intentions/intentionsStorage';
import { getActiveAccountId } from '@/services/account/accountRuntime';
import { runLocalOperationWithAccountRecovery } from '@/services/account/accountOperationRecovery';
import { hindsightClear } from '@/services/memory/hindsight/hindsightClient';
import { clearHindsightRebuildState } from '@/services/memory/hindsight/hindsightRebuild';

export interface ClearJournalHistoryResult {
    /**
     * Labels of the local groups that could not be cleared. Empty means the
     * wipe completed. The caller must surface a non-empty list to the user -
     * a silent partial wipe is worse than a visible failure (DEF-011).
     */
    readonly failedSteps: string[];
}

interface UseClearJournalHistoryReturn {
    clearAll: () => Promise<ClearJournalHistoryResult>;
    isClearing: boolean;
}

export function useClearJournalHistory(): UseClearJournalHistoryReturn {
    const [isClearing, setIsClearing] = useState(false);

    const clearAll = useCallback(async (): Promise<ClearJournalHistoryResult> => {
        setIsClearing(true);
        const accountId = getActiveAccountId();
        const failedSteps: string[] = [];
        try {
            // Each group runs as its own local operation so one failure cannot
            // strand the groups after it (the previous all-in-one chain aborted
            // wholesale when the auth gateway died - DEF-011).
            const steps: Array<readonly [string, () => Promise<void>]> = [
                ['journal entries', clearAllEntries],
                ['intention check-ins', clearAllCheckIns],
                ['journal memories', () => deleteMemoryAtomsBySource('journal')],
                ['check-in memories', () => deleteMemoryAtomsBySource('intention')],
                ['day digests', clearDayDigests],
                ['session digests', clearSessionDigests],
                ['memory rollups', clearMemoryRollups],
                ['rollup attempts', clearRollupAttempts],
                ['memory files', clearMemoryFiles],
                ['identity profile', clearIdentityProfile],
                ['chat sessions', removeAllChatSessions],
                ['weekly insights', clearCachedInsights],
                ['saved insights', clearSavedInsights],
                ['hindsight rebuild state', clearHindsightRebuildState],
            ];

            for (const [label, step] of steps) {
                try {
                    await runLocalOperationWithAccountRecovery(accountId, step);
                } catch (error) {
                    failedSteps.push(label);
                    console.warn(`Clear history step failed: ${label}`, error);
                }
            }

            if (accountId) {
                void hindsightClear(accountId).catch((error) => {
                    console.warn('Remote Hindsight clear unavailable:', error);
                });
            }

            return { failedSteps };
        } finally {
            setIsClearing(false);
        }
    }, []);

    return {
        clearAll,
        isClearing,
    };
}
