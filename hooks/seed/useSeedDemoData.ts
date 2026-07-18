import { useCallback, useState } from 'react';

import { seedBulkProbeJournal, seedDemoData } from '@/services/seed/seedDemoData';

interface UseSeedDemoDataReturn {
    seed: () => Promise<void>;
    seedBulk: (count?: number) => Promise<number>;
    isSeeding: boolean;
}

export function useSeedDemoData(): UseSeedDemoDataReturn {
    const [isSeeding, setIsSeeding] = useState(false);

    const seed = useCallback(async () => {
        setIsSeeding(true);
        try {
            await seedDemoData();
        } finally {
            setIsSeeding(false);
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
    };
}
