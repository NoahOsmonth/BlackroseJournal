import { useCallback, useState } from 'react';

import {
    demoSeedStepCount,
    seedBulkProbeJournal,
    seedDemoData,
} from '@/services/seed/seedDemoData';
import type { DemoSeedProgress } from '@/services/seed/seedDemoData';

interface UseSeedDemoDataReturn {
    seed: () => Promise<void>;
    seedBulk: (count?: number) => Promise<number>;
    isSeeding: boolean;
    /** Row progress while a demo seed runs; null when idle. */
    seedProgress: DemoSeedProgress | null;
}

export function useSeedDemoData(): UseSeedDemoDataReturn {
    const [isSeeding, setIsSeeding] = useState(false);
    const [seedProgress, setSeedProgress] = useState<DemoSeedProgress | null>(null);

    const seed = useCallback(async () => {
        setIsSeeding(true);
        // Known up-front so the row can show "n/total" from the first write.
        setSeedProgress({ completed: 0, total: demoSeedStepCount() });
        try {
            await seedDemoData({ onProgress: setSeedProgress });
        } finally {
            setIsSeeding(false);
            setSeedProgress(null);
        }
    }, []);

    const seedBulk = useCallback(async (count?: number) => {
        setIsSeeding(true);
        try {
            return await seedBulkProbeJournal({ count });
        } finally {
            setIsSeeding(false);
        }
    }, []);

    return {
        seed,
        seedBulk,
        isSeeding,
        seedProgress,
    };
}
