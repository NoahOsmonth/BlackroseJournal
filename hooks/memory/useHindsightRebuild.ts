import { useEffect } from 'react';
import { ensurePrivateHindsightRebuild } from '@/services/memory/hindsight/hindsightRebuild';

export function useHindsightRebuild(accountId: string | null, enabled: boolean): void {
    useEffect(() => {
        if (!accountId || !enabled) return;
        void ensurePrivateHindsightRebuild(accountId).catch((error) => {
            console.warn('Private Hindsight rebuild unavailable:', error);
        });
    }, [accountId, enabled]);
}
