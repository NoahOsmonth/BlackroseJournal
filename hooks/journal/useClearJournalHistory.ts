import { useCallback, useState } from 'react';

import { clearCachedInsights } from '@/services/insights/weeklyInsightsStorage';
import { clearSavedInsights } from '@/services/saved-insights/savedInsightsStorage';
import { deleteMemoryAtomsBySource } from '@/services/memory/localMemory';
import { removeJournalChatSessions } from '@/services/ai/sessionStorage';
import { clearAllEntries } from '@/services/journal/journalStorage';

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
            await deleteMemoryAtomsBySource('journal');
            await removeJournalChatSessions();
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
