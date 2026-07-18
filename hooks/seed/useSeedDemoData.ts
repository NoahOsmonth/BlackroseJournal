import { useCallback, useState } from 'react';

import { seedDemoData } from '@/services/seed/seedDemoData';

interface UseSeedDemoDataReturn {
    seed: () => Promise<void>;
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

    return {
        seed,
        isSeeding,
    };
}
