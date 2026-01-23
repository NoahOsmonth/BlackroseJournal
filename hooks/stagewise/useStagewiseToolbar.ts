import { useEffect } from 'react';

import { setupStagewiseToolbar } from '@/services/stagewise/stagewiseToolbar';

export const useStagewiseToolbar = (): void => {
    useEffect(() => {
        void setupStagewiseToolbar();
    }, []);
};
