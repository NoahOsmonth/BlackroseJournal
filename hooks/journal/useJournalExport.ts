import { useCallback } from 'react';

import { getAllEntriesForExport } from '@/services/journal/journalStorage';

interface UseJournalExportReturn {
    exportAsJson: () => Promise<string>;
}

export function useJournalExport(): UseJournalExportReturn {
    const exportAsJson = useCallback(async () => {
        return getAllEntriesForExport();
    }, []);

    return {
        exportAsJson,
    };
}
