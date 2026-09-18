import { useCallback } from 'react';
import { Share } from 'react-native';

import { downloadTextFile } from '@/components/ui/webDownload';
import { getAllEntriesForExport } from '@/services/journal/journalStorage';

interface UseJournalExportReturn {
    exportAsJson: () => Promise<string>;
    /** Web: real file download. Native: system share sheet. */
    shareJson: (json: string, fileName: string) => Promise<void>;
}

export function useJournalExport(): UseJournalExportReturn {
    const exportAsJson = useCallback(async () => {
        return getAllEntriesForExport();
    }, []);

    const shareJson = useCallback(async (json: string, fileName: string) => {
        // Share.share is unimplemented on web (DEF-010) — download instead.
        if (downloadTextFile(fileName, json)) {
            return;
        }
        await Share.share({ message: json, title: 'Journal Export' });
    }, []);

    return {
        exportAsJson,
        shareJson,
    };
}
