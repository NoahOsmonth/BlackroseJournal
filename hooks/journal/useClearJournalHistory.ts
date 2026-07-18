import { useCallback, useState } from 'react';

import { clearCachedInsights } from '@/services/insights/weeklyInsightsStorage';
import { clearSavedInsights } from '@/services/saved-insights/savedInsightsStorage';
import { clearDayDigests } from '@/services/memory/dayDigestStorage';
import { clearIdentityProfile } from '@/services/memory/identityProfile';
import { deleteMemoryAtomsBySource } from '@/services/memory/localMemory';
import { clearSessionDigests } from '@/services/memory/sessionDigestStorage';
import { clearMemoryRollups } from '@/services/memory/memoryRollupStorage';
import { clearRollupAttempts } from '@/services/memory/memoryRollupBuild';
import { removeAllChatSessions } from '@/services/ai/sessionStorage';
import { clearAllEntries } from '@/services/journal/journalStorage';
import { clearAllCheckIns } from '@/services/intentions/intentionsStorage';

interface UseClearJournalHistoryReturn {
    clearAll: () => Promise<void>;
    isClearing: boolean;
}

export function useClearJournalHistory(): UseClearJournalHistoryReturn {
    const [isClearing, setIsClearing] = useState(false);

    const clearAll = useCallback(async () => {
        setIsClearing(true);
        try {
            await clearAllEntries();
            await clearAllCheckIns();
            await deleteMemoryAtomsBySource('journal');
            await deleteMemoryAtomsBySource('intention');
            await clearDayDigests();
            await clearSessionDigests();
            await clearMemoryRollups();
            await clearRollupAttempts();
            await clearIdentityProfile();
            await removeAllChatSessions();
            await clearCachedInsights();
            await clearSavedInsights();
        } finally {
            setIsClearing(false);
        }
    }, []);

    return {
        clearAll,
        isClearing,
    };
}
